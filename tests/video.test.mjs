import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectPhoto, photoIssues } from "../tools/photo.mjs";
import {
  contactSheet, formatTime, inspectVideo, parseTime, planClip, probe, processVideo, run, shotDate, videoIssues,
} from "../tools/video.mjs";

// ---------- 拼一个最小的 MP4，只有检查器要读的那几个盒子 ----------
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length + 8, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, body]);
};
const u32 = (...ns) => Buffer.concat(ns.map((n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }));
const mvhd = ({ created = 0, seconds = 12 } = {}) => box("mvhd", u32(0, created, 0, 1000, seconds * 1000), Buffer.alloc(80));
const IDENTITY = u32(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);
const ROTATED = u32(0, 0x10000, 0, 0xffff0000, 0, 0, 0, 0, 0x40000000);
const tkhd = (w, h, matrix = IDENTITY) => box("tkhd", u32(0, 0, 0, 1, 0, 0, 0, 0, 0, 0), matrix, u32(w * 65536, h * 65536));
const stsd = (codec) => box("stsd", u32(0, 1), box(codec, Buffer.alloc(8)));
const trak = (w, h, codec, matrix) => box("trak", tkhd(w, h, matrix), box("mdia", box("minf", box("stbl", stsd(codec)))));
const mp4 = ({ moov, mdatFirst = false }) => {
  const ftyp = box("ftyp", Buffer.from("isom\0\0\x02\0isomavc1", "latin1"));
  const mdat = box("mdat", Buffer.alloc(16));
  return Buffer.concat(mdatFirst ? [ftyp, mdat, moov] : [ftyp, moov, mdat]);
};
const clean = () => box("moov", mvhd(), trak(1280, 720, "avc1"), trak(0, 0, "mp4a"));

test("读得出 MP4 的时长、尺寸、编码", () => {
  assert.deepEqual(inspectVideo(mp4({ moov: clean() })), {
    type: "mp4", seconds: 12, width: 1280, height: 720, codecs: ["avc1", "mp4a"], meta: false, faststart: true,
  });
  assert.deepEqual(videoIssues(mp4({ moov: clean() })), []);
});

test("竖着拍的（矩阵转了 90°）宽高对调", () => {
  const info = inspectVideo(mp4({ moov: box("moov", mvhd(), trak(1280, 720, "avc1", ROTATED)) }));
  assert.equal(info.width, 720);
  assert.equal(info.height, 1280);
});

test("拍摄时间、位置、苹果的 keys 都算拍摄信息；ffmpeg 留下的编码器名不算", () => {
  const issues = (moov) => videoIssues(mp4({ moov })).join("\n");
  assert.match(issues(box("moov", mvhd({ created: 3800000000 }), trak(1280, 720, "avc1"))), /拍摄信息/);
  assert.match(issues(box("moov", mvhd(), trak(1280, 720, "avc1"), box("udta", box("\u00a9xyz", Buffer.from("+39.9+116.4/"))))), /拍摄信息/);
  const keys = box("keys", u32(0, 1), box("mdta", Buffer.from("com.apple.quicktime.location.ISO6709")));
  assert.match(issues(box("moov", mvhd(), trak(1280, 720, "avc1"), box("meta", box("hdlr", Buffer.alloc(25)), keys))), /拍摄信息/);
  const encoder = box("udta", box("meta", u32(0), box("hdlr", Buffer.alloc(25)), box("ilst", box("\u00a9too", box("data", u32(1, 0), Buffer.from("Lavf"))))));
  assert.equal(issues(box("moov", mvhd(), trak(1280, 720, "avc1"), encoder)), "");
});

test("HEVC、索引在后面、太长、太大都不能直接发布", () => {
  assert.match(videoIssues(mp4({ moov: box("moov", mvhd(), trak(1280, 720, "hvc1")) })).join(), /H\.264/);
  assert.match(videoIssues(mp4({ moov: clean(), mdatFirst: true })).join(), /索引在文件末尾/);
  assert.match(videoIssues(mp4({ moov: box("moov", mvhd({ seconds: 200 }), trak(1280, 720, "avc1")) })).join(), /太长/);
  assert.match(videoIssues(mp4({ moov: box("moov", mvhd(), trak(2560, 1440, "avc1")) })).join(), /太大/);
  assert.match(videoIssues(Buffer.from("not a video")).join(), /认不出来/);
});

test("时间写法：秒、分:秒、时:分:秒", () => {
  assert.equal(parseTime("12.5"), 12.5);
  assert.equal(parseTime("0:12.5"), 12.5);
  assert.equal(parseTime("1:02:03"), 3723);
  for (const bad of ["", "1:60", "a", "1:2:3:4", "-3", "1.5:00"]) assert.throws(() => parseTime(bad), /看不懂/);
  assert.equal(formatTime(5), "0:05");
  assert.equal(formatTime(62.54), "1:02.5");
  assert.equal(formatTime(3723), "1:02:03");
});

test("起止点：在原片里、不太短、不超过上限；封面默认落在前三分之一", () => {
  assert.deepEqual(planClip({ duration: 30, from: 2, to: 11 }), { start: 2, length: 9, posterAt: 3 });
  assert.deepEqual(planClip({ duration: 6 }), { start: 0, length: 6, posterAt: 2 });
  assert.equal(planClip({ duration: 30, from: 2, to: 11, poster: 10 }).posterAt, 8);
  assert.throws(() => planClip({ duration: 300 }), /超过 180 秒/);
  assert.throws(() => planClip({ duration: 30, from: 31 }), /超过了原片/);
  assert.throws(() => planClip({ duration: 30, to: 40 }), /超过了原片/);
  assert.throws(() => planClip({ duration: 30, from: 5, to: 5.5 }), /不到 1 秒/);
  assert.throws(() => planClip({ duration: 30, from: 2, to: 11, poster: 12 }), /--poster/);
});

test("拍摄日：苹果带时区的取当地日子，UTC 的换成本机日子，读不出就是 null", () => {
  assert.equal(shotDate("2026-06-01T23:30:00+0800"), "2026-06-01");
  const utc = new Date("2026-06-01T12:00:00Z");
  assert.equal(shotDate("2026-06-01T12:00:00.000000Z"), utc.toLocaleDateString("sv-SE"));
  assert.equal(shotDate("1970-01-01T00:00:00Z"), null);
  assert.equal(shotDate(undefined), null);
});

const hasFfmpeg = ["ffmpeg", "ffprobe"].every((cmd) => spawnSync(process.env[`${cmd.toUpperCase()}_PATH`] || cmd, ["-version"], { stdio: "ignore", windowsHide: true }).status === 0);
// CI 只检查和构建，不剪视频；runner 上的 ffmpeg 版本也说不准（-display_rotation 要 7.0+）
const skipReal = process.env.CI ? "CI 上不剪视频" : !hasFfmpeg && "没装 ffmpeg";

test("真剪一段：转正、缩小、限帧、去掉拍摄信息，封面也干净", { skip: skipReal }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "kid-growth-video-test-"));
  try {
    const flat = join(dir, "flat.mp4");
    await run(process.env.FFMPEG_PATH || "ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=2560x1440:rate=60",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
      "-t", "8", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
      "-metadata", "creation_time=2026-06-01T04:30:00Z", "-metadata", "location=+39.9042+116.4074/",
      flat,
    ]);
    // 手机竖着拍：画面是横的，靠旋转标记竖过来
    const source = join(dir, "IMG_0001.MOV");
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-y", "-display_rotation:v:0", "90", "-i", flat, "-c", "copy", "-map_metadata", "0", source]);

    const raw = await probe(source);
    assert.equal(raw.width, 1440);
    assert.equal(raw.height, 2560);
    assert.equal(raw.audio, true);
    assert.equal(raw.located, true);
    assert.equal(raw.date, shotDate("2026-06-01T04:30:00Z"));
    assert.match(videoIssues(readFileSync(source)).join("\n"), /拍摄信息/);
    assert.match(videoIssues(readFileSync(source)).join("\n"), /太大/);

    const out = join(dir, "moment");
    const made = await processVideo(source, { from: 1.5, to: 6.5, poster: 3, dir: out, name: "01" });
    assert.ok(Math.abs(made.seconds - 5) < 0.2, `时长 ${made.seconds}`);
    assert.equal(made.width, 720);
    assert.equal(made.height, 1280);
    assert.equal(made.audio, true);
    assert.equal(made.located, false);
    assert.equal(made.date, null);

    const clip = readFileSync(join(out, "01.mp4"));
    const info = inspectVideo(clip);
    assert.deepEqual(videoIssues(clip), []);
    assert.deepEqual(info.codecs, ["avc1", "mp4a"]);
    assert.equal(info.faststart, true);
    const rate = (await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate", "-of", "csv=p=0", join(out, "01.mp4")])).trim();
    const [frames, per] = rate.split("/").map(Number);
    assert.ok(frames / per <= 30.01, `帧率 ${rate}`);

    const poster = readFileSync(join(out, "01.poster.jpg"));
    assert.deepEqual(photoIssues(poster), []);
    assert.equal(inspectPhoto(poster).width, 720);
    assert.equal(inspectPhoto(poster).height, 1280);

    const muted = await processVideo(source, { from: 0, to: 2, mute: true, dir: out, name: "02" });
    assert.equal(muted.audio, false);
    assert.deepEqual(inspectVideo(readFileSync(join(out, "02.mp4"))).codecs, ["avc1"]);
    assert.ok(existsSync(join(out, "01.mp4")), "剪第二段不动第一段");

    await assert.rejects(processVideo(source, { from: 7.5, dir: join(dir, "short"), name: "01" }), /不到 1 秒/);
    assert.equal(existsSync(join(dir, "short")), false);

    const sheet = await contactSheet(source, { every: 1, outDir: join(dir, "frames") });
    assert.equal(sheet.times.length, 8);
    const img = inspectPhoto(readFileSync(sheet.file));
    assert.equal(img.width, 6 * 320 + 7 * 6);
    assert.equal(img.height, 2 * 320 + 3 * 6);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});