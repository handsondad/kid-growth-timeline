// 把一段原片剪成能放进时光轴的小视频。页面只管播放，剪辑都在这里做，给 agent 在后台跑。
//
//   npm run video -- --info <原片>
//       看时长、尺寸、编码、拍摄日期、带没带位置；不写任何文件
//   npm run video -- --frames <原片 或 瞬间id/编号> [--every 2] [--from 0:10] [--to 0:40]
//       每隔几秒截一帧，拼成一张大图放在 private/frames/，给能看图的 agent 挑起止点、看拍了什么；
//       写 first-bike/03 就看时光库里剪好的 03.mp4
//
// 真正剪一段用 npm run moment:add -- <id> <原片> --from --to（它调这里的 processVideo）。
// 时间可以写 12.5、0:12.5、1:02:03。输出是 H.264 + AAC 的 MP4，长边 1280，最多 30 帧，码率封顶 2 Mbps，
// 去掉拍摄时间、GPS、机型这些信息，索引放在文件头。原片不动。
// 需要 PATH 里的 ffmpeg / ffprobe（带 libx264），或者用环境变量 FFMPEG_PATH、FFPROBE_PATH 指定。
import { spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ID, momentDir, root } from "./library.mjs";
import { photoIssues } from "./photo.mjs";

export const CLIP = {
  /** 一段小视频最长多少秒：挑最好的一段，不是把原片整个搬上来 */
  maxSeconds: 180,
  minSeconds: 1,
  /** 长边最多多少像素（检查器的上限） */
  maxSide: 1920,
  /** 剪的时候缩到的长边：720p 在手机、平板上看不出差别，体积不到 1080p 的一半 */
  targetSide: 1280,
  /** 一段最多多大：GitHub 不收超过 100 MB 的文件，Pages 整站也只有 1 GB */
  maxBytes: 90 * 1024 * 1024,
  /** 截帧拼图最多几格 */
  maxFrames: 48,
};

export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".3gp"];

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

/** 「12.5」「0:12.5」「1:02:03」→ 秒 */
export function parseTime(text) {
  const parts = String(text).trim().split(":");
  const ok = parts.length <= 3
    && parts.every((p, i) => (i === parts.length - 1 ? /^\d+(\.\d+)?$/ : /^\d+$/).test(p))
    && parts.slice(1).every((p) => Number(p) < 60);
  if (!ok) throw new Error(`看不懂时间「${text}」，写成 12.5、0:12.5 或 1:02:03`);
  return parts.reduce((sum, p) => sum * 60 + Number(p), 0);
}

/** 秒 → 「0:05」「1:02.5」「1:02:03」，精确到 0.1 秒 */
export function formatTime(seconds) {
  const tenths = Math.round(seconds * 10);
  const s = (tenths % 600) / 10;
  const m = Math.floor(tenths / 600) % 60;
  const h = Math.floor(tenths / 36000);
  const ss = (s < 10 ? "0" : "") + (Number.isInteger(s) ? String(s) : s.toFixed(1));
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 按原片时长核对起止点和封面，返回 ffmpeg 要的开始、长度和封面在成片里的位置 */
export function planClip({ duration, from = 0, to, poster }) {
  if (!(duration > 0)) throw new Error("读不出原片有多长");
  const end = to ?? duration;
  if (from >= duration) throw new Error(`--from ${formatTime(from)} 超过了原片（${formatTime(duration)}）`);
  if (end > duration + 0.05) throw new Error(`--to ${formatTime(end)} 超过了原片（${formatTime(duration)}）`);
  const length = Math.min(end, duration) - from;
  if (length < CLIP.minSeconds) throw new Error(`剪出来不到 ${CLIP.minSeconds} 秒，看看 --from / --to`);
  if (length > CLIP.maxSeconds + 0.001) {
    throw new Error(`剪出来有 ${formatTime(length)}，超过 ${CLIP.maxSeconds} 秒；先 --frames 看一遍，用 --from / --to 挑最好的一段`);
  }
  const at = poster ?? from + Math.min(length / 3, 3);
  if (at < from || at >= from + length) throw new Error(`--poster ${formatTime(at)} 要在剪出来的这段里（${formatTime(from)}–${formatTime(from + length)}）`);
  const ms = (n) => Math.round(n * 1000) / 1000;
  return { start: ms(from), length: ms(length), posterAt: ms(at - from) };
}

/** 剪一段：重新编码，所以起止点能落在任何一帧上，转正、缩小、去掉拍摄信息一起做 */
export function encodeArgs(input, output, plan, { mute = false } = {}) {
  const side = CLIP.targetSide;
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-ss", plan.start.toFixed(3), "-t", plan.length.toFixed(3), "-i", input,
    "-map", "0:v:0", ...(mute ? ["-an"] : ["-map", "0:a:0?"]),
    "-map_metadata", "-1", "-map_chapters", "-1",
    "-vf", `scale=w='min(iw,${side})':h='min(ih,${side})':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1`,
    "-fpsmax", "30",
    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-maxrate", "2M", "-bufsize", "4M",
    "-pix_fmt", "yuv420p", "-profile:v", "high",
    ...(mute ? [] : ["-c:a", "aac", "-b:a", "96k", "-ac", "2"]),
    "-movflags", "+faststart",
    "-f", "mp4", output,
  ];
}

/** 从成片里截一帧当封面 */
export function posterArgs(clip, output, at) {
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-ss", at.toFixed(3), "-i", clip,
    "-frames:v", "1", "-map_metadata", "-1", "-q:v", "3",
    output,
  ];
}

// ---------- 读 MP4：给检查器用，不需要 ffmpeg ----------

/** 往下钻的盒子；meta 单独处理（有两种写法） */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "udta", "edts", "dinf", "ilst"]);
/** 这些盒子里放的是位置、日期、机型、XMP */
const META_BOXES = new Set(["\u00a9xyz", "\u00a9day", "\u00a9mak", "\u00a9mod", "loci", "XMP_"]);

function* boxes(buf, start, end) {
  let i = start;
  while (i + 8 <= end) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    let head = 8;
    if (size === 1) {
      if (i + 16 > end) return;
      size = Number(buf.readBigUInt64BE(i + 8));
      head = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < head || i + size > end) return;
    yield { type, start: i + head, end: i + size };
    i += size;
  }
}

/** MP4 的时长、画面尺寸、编码、带没带拍摄信息、索引在不在前面；认不出来返回 null */
export function inspectVideo(buf) {
  const top = [...boxes(buf, 0, buf.length)];
  if (top[0]?.type !== "ftyp") return null;
  const moovAt = top.findIndex((b) => b.type === "moov");
  if (moovAt < 0) return null;
  const mdatAt = top.findIndex((b) => b.type === "mdat");
  const info = { type: "mp4", seconds: 0, width: 0, height: 0, codecs: [], meta: false, faststart: mdatAt < 0 || moovAt < mdatAt };

  const walk = (start, end) => {
    for (const b of boxes(buf, start, end)) {
      if (META_BOXES.has(b.type)) info.meta = true;
      if (b.type === "mvhd") {
        const v1 = buf[b.start] === 1;
        const created = v1 ? Number(buf.readBigUInt64BE(b.start + 4)) : buf.readUInt32BE(b.start + 4);
        const scale = buf.readUInt32BE(b.start + (v1 ? 20 : 12));
        const duration = v1 ? Number(buf.readBigUInt64BE(b.start + 24)) : buf.readUInt32BE(b.start + 16);
        if (created) info.meta = true;
        if (scale) info.seconds = duration / scale;
      } else if (b.type === "tkhd") {
        const at = b.start + (buf[b.start] === 1 ? 88 : 76);
        let w = Math.round(buf.readUInt32BE(at) / 65536);
        let h = Math.round(buf.readUInt32BE(at + 4) / 65536);
        // 变换矩阵 a = 0 是转了 90° 或 270°，播放时宽高对调
        if (buf.readInt32BE(at - 36) === 0) [w, h] = [h, w];
        if (w * h > info.width * info.height) Object.assign(info, { width: w, height: h });
      } else if (b.type === "stsd") {
        const entry = boxes(buf, b.start + 8, b.end).next().value;
        if (entry) info.codecs.push(entry.type);
      } else if (b.type === "keys") {
        // 苹果把位置、拍摄时间、机型写成 com.apple.quicktime.location.ISO6709 这样的键
        if (/location|creationdate|\.make|\.model/i.test(buf.toString("latin1", b.start, b.end))) info.meta = true;
      } else if (b.type === "meta") {
        // ISO 的 meta 前面有 4 字节版本号，QuickTime 的没有，第一个孩子都是 hdlr
        const qt = buf.toString("latin1", b.start + 4, b.start + 8) === "hdlr";
        walk(qt ? b.start : b.start + 4, b.end);
      } else if (CONTAINERS.has(b.type)) {
        walk(b.start, b.end);
      }
    }
  };
  walk(top[moovAt].start, top[moovAt].end);
  return info;
}

/** 返回问题列表，空数组表示这段视频能直接发布 */
export function videoIssues(buf) {
  const info = inspectVideo(buf);
  const redo = "删掉后用 npm run moment:add 重新剪";
  if (!info) return [`认不出来，只收 MP4，${redo}`];
  const problems = [];
  if (info.meta) problems.push(`带着拍摄信息（时间、GPS、机型），${redo}`);
  if (!info.codecs.includes("avc1")) problems.push(`画面编码是 ${info.codecs.join(" / ") || "认不出的"}，只收 H.264，${redo}`);
  else if (info.codecs.some((c) => c !== "avc1" && c !== "mp4a")) problems.push(`有不认识的轨道（${info.codecs.join(" / ")}），${redo}`);
  if (!info.faststart) problems.push(`索引在文件末尾，${redo}`);
  if (info.seconds > CLIP.maxSeconds + 0.5) problems.push(`${formatTime(info.seconds)} 太长，不超过 ${CLIP.maxSeconds} 秒`);
  if (Math.max(info.width, info.height) > CLIP.maxSide) problems.push(`${info.width}×${info.height} 太大，长边不超过 ${CLIP.maxSide}`);
  if (buf.length > CLIP.maxBytes) problems.push(`${(buf.length / 1048576).toFixed(1)} MB 太大，不超过 ${CLIP.maxBytes / 1048576} MB，剪短一点`);
  return problems;
}

// ---------- 调 ffmpeg ----------

export function run(command, args) {
  return new Promise((ok, fail) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err = (err + chunk).slice(-2000); });
    child.on("error", (error) => {
      fail(error.code === "ENOENT"
        ? new Error(`找不到 ${command}：装好 ffmpeg（带 ffprobe 和 libx264）放进 PATH，或者用环境变量 FFMPEG_PATH、FFPROBE_PATH 指定`)
        : error);
    });
    child.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(`${basename(command)} 没跑成（退出码 ${code}）：${err.trim().slice(-400)}`))));
  });
}

/** 拍摄日期：苹果的 creationdate 带着当地时区，直接取日子；UTC 的换成本机的日子 */
export function shotDate(text) {
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+[+-]\d{2}:?\d{2}$/.test(text)) return text.slice(0, 10);
  const d = new Date(text);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1971) return null;
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
}

/** 用 ffprobe 读原片 */
export async function probe(file) {
  if (!existsSync(file)) throw new Error(`找不到视频：${file}`);
  const parsed = JSON.parse(await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video) throw new Error("这个文件里没有画面");
  let { width, height } = video;
  const rotation = video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? Number(video.tags?.rotate ?? 0);
  if (Math.abs(rotation % 180) === 90) [width, height] = [height, width];
  const tags = { ...parsed.format?.tags, ...video.tags };
  return {
    seconds: Number(parsed.format?.duration ?? video.duration),
    width,
    height,
    codec: video.codec_name,
    audio: streams.some((s) => s.codec_type === "audio"),
    date: shotDate(tags["com.apple.quicktime.creationdate"] ?? tags.creation_time),
    located: Object.keys(tags).some((k) => /location/i.test(k)),
    hdr: ["arib-std-b67", "smpte2084"].includes(video.color_transfer),
  };
}

/** 剪一段写到 <dir>/<name>.mp4 + <name>.poster.jpg；先在临时目录里做完、验过，再挪进来 */
export async function processVideo(source, { dir, name, from, to, poster, mute = false }) {
  const src = resolve(source);
  if (!VIDEO_EXTENSIONS.includes(extname(src).toLowerCase())) throw new Error(`不认识 ${extname(src) || "这种"}文件，只收 ${VIDEO_EXTENSIONS.join(" ")}`);
  const out = dir;
  const info = await probe(src);
  const plan = planClip({ duration: info.seconds, from, to, poster });

  const scratch = mkdtempSync(join(tmpdir(), "kid-growth-video-"));
  try {
    const clip = join(scratch, "clip.mp4");
    const cover = join(scratch, "poster.jpg");
    await run(FFMPEG, encodeArgs(src, clip, plan, { mute }));
    await run(FFMPEG, posterArgs(clip, cover, plan.posterAt));

    const problems = [...videoIssues(readFileSync(clip)), ...photoIssues(readFileSync(cover)).map((p) => `封面${p}`)];
    const made = await probe(clip);
    if (Math.abs(made.seconds - plan.length) > 0.5) problems.push(`剪出来 ${formatTime(made.seconds)}，和要的 ${formatTime(plan.length)} 对不上`);
    if (problems.length) throw new Error(`剪出来的不合格，没有放进去：\n${problems.join("\n")}`);

    mkdirSync(out, { recursive: true });
    copyFileSync(clip, join(out, `${name}.mp4`));
    copyFileSync(cover, join(out, `${name}.poster.jpg`));

    const range = `${formatTime(plan.start)}–${formatTime(plan.start + plan.length)}`;
    const notes = join(out, "notes.md");
    if (existsSync(notes)) {
      const today = new Date().toLocaleDateString("sv-SE");
      const line = `- ${today} ${name}.mp4：原片 ${basename(src)}（${formatTime(info.seconds)}），剪 ${range}，封面 ${formatTime(plan.start + plan.posterAt)}${mute ? "，去掉了声音" : ""}\n`;
      appendFileSync(notes, readFileSync(notes, "utf8").includes("## 剪辑") ? line : `\n## 剪辑\n\n${line}`);
    }
    return { ...made, range, dir: out, bytes: statSync(join(out, `${name}.mp4`)).size };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** 每隔 every 秒截一帧拼成一张图，返回图的路径和每一格对应的时间 */
export async function contactSheet(source, { every = 2, from = 0, to, cols = 6, outDir = join(root, "private/frames") } = {}) {
  const src = resolve(source);
  const info = await probe(src);
  const end = Math.min(to ?? info.seconds, info.seconds);
  if (from >= end) throw new Error(`--from ${formatTime(from)} 超过了视频（${formatTime(info.seconds)}）`);
  const span = end - from;
  const step = Math.max(every, Math.ceil((span / CLIP.maxFrames) * 10) / 10);
  const times = [];
  for (let t = 0; t < span && times.length < CLIP.maxFrames; t += step) times.push(from + t);
  const rows = Math.ceil(times.length / cols);
  const cell = 320;

  mkdirSync(outDir, { recursive: true });
  const name = basename(src, extname(src)) + (from || to !== undefined ? `-${Math.round(from)}-${Math.round(end)}` : "");
  const out = join(outDir, `${name}.jpg`);
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-ss", from.toFixed(3), "-t", span.toFixed(3), "-i", src,
    "-vf", `fps=1/${step},scale=${cell}:${cell}:force_original_aspect_ratio=decrease,pad=${cell}:${cell}:(ow-iw)/2:(oh-ih)/2:color=white,tile=${cols}x${rows}:margin=6:padding=6:color=white`,
    "-frames:v", "1", "-q:v", "4", out,
  ]);
  return { file: out, cols, step, times, info };
}

// ---------- 命令行 ----------

/** 原片和 moment:add 共用：--from --to --poster --every 时间，--mute，其余是位置参数 */
export function parseArgs(argv) {
  const opts = { mode: null, mute: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--info") opts.mode = "info";
    else if (a === "--frames") opts.mode = "frames";
    else if (a === "--mute") opts.mute = true;
    else if (["--from", "--to", "--poster", "--every"].includes(a)) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${a} 后面要写时间`);
      opts[a.slice(2)] = parseTime(value);
      if (a === "--every" && !(opts.every > 0)) throw new Error("--every 要大于 0");
    } else if (a.startsWith("--")) throw new Error(`不认识 ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

const USAGE = `用法：
  npm run video -- --info <原片>
  npm run video -- --frames <原片 或 瞬间id/编号> [--every 2] [--from 0:10] [--to 0:40]
剪一段放进瞬间：npm run moment:add -- <瞬间id> <原片> [--from 0:12.5] [--to 0:41] [--poster 0:20] [--mute]`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.mode === "info") {
    const [file] = opts.positional;
    if (!file) throw new Error(USAGE);
    const info = await probe(resolve(file));
    console.log(`时长    ${formatTime(info.seconds)}${info.seconds > CLIP.maxSeconds ? `（超过 ${CLIP.maxSeconds} 秒，要用 --from / --to 挑一段）` : ""}`);
    console.log(`画面    ${info.width}×${info.height}，${info.codec}${info.hdr ? "，HDR（剪出来颜色可能发灰，最好先在手机上导出成「兼容」格式）" : ""}`);
    console.log(`声音    ${info.audio ? "有（发布前请大人听一遍：有没有人喊真名、学校名）" : "没有"}`);
    console.log(`拍摄日  ${info.date ?? "读不出来，问大人"}`);
    console.log(`位置    ${info.located ? "原片里有，剪的时候会去掉" : "没有"}`);
    return;
  }
  if (opts.mode === "frames") {
    const [target] = opts.positional;
    if (!target) throw new Error(USAGE);
    // 写 瞬间id/编号 就看时光库里剪好的成片
    const [id, n] = target.split("/");
    const file = !existsSync(target) && ID.test(id) && /^\d{2}$/.test(n ?? "") ? join(momentDir(id), `${n}.mp4`) : target;
    const sheet = await contactSheet(file, opts);
    console.log(`${sheet.file.slice(root.length + 1).replaceAll("\\", "/")}（每 ${sheet.step} 秒一格，${sheet.times.length} 格，从左到右、从上到下）`);
    for (let r = 0; r * sheet.cols < sheet.times.length; r++) {
      console.log(`第 ${r + 1} 行：${sheet.times.slice(r * sheet.cols, (r + 1) * sheet.cols).map(formatTime).join("  ")}`);
    }
    return;
  }
  throw new Error(USAGE);
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
