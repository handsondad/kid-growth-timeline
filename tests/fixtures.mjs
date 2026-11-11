// 测试用的假时光库：现场生成，用完删掉
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 最小的干净 JPEG：只有 JFIF 头和尺寸（900×1200） */
const seg = (marker, body) => {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xff00 | marker, 0);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};
const sof = Buffer.alloc(6);
sof.writeUInt16BE(1200, 1);
sof.writeUInt16BE(900, 3);
export const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
  seg(0xc0, sof),
  Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9]),
]);

export const GOOD = {
  title: "第一次骑车",
  about: "在公园里自己骑出去好远。",
  when: { date: "2026-05-01" },
  blocks: [{ photos: ["01.jpg"], caption: "小路上的蓝色自行车" }],
};

export const add = (dir, id, files) => {
  mkdirSync(join(dir, id), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, id, name), body);
};

/** 一个瞬间 first-bike（一张照片）+ library.json */
export function makeLibrary() {
  const dir = mkdtempSync(join(tmpdir(), "kid-growth-library-"));
  writeFileSync(join(dir, "library.json"), JSON.stringify({ birthday: "2022-09-08", covers: { 2026: "first-bike/01.jpg" } }));
  add(dir, "first-bike", { "moment.json": JSON.stringify(GOOD), "notes.md": "# first-bike\n", "01.jpg": JPEG });
  return dir;
}
