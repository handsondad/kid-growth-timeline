// 内容检查：时光库里的 library.json 和每个瞬间的字数、日子、每一段图文、媒体文件（大小、编码、拍摄信息）。不需要 ffmpeg。
// 用法：
//   npm run check
//   npm run check -- first-bike
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ID, readLibrary } from "../tools/library.mjs";
import { photoIssues } from "../tools/photo.mjs";
import { videoIssues } from "../tools/video.mjs";
import { blockKind, mediaFiles, PHOTO_FILE, posterOf, VIDEO_FILE } from "../src/moment/vocab.ts";

const LIMITS = {
  title: 12,
  about: 80,
  caption: 60,
  text: 300,
  said: 40,
  label: 8,
  name: 8,
  blocks: 40,
  photos: 3,
};

/** 时光库目录里除了媒体文件，还可以有这些 */
const KEEP = ["moment.json", "notes.md"];

const chars = (text) => [...text].length;
const isDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day ?? "") && !Number.isNaN(Date.parse(day));

/** 返回问题列表，空数组表示通过；dir 是这个瞬间在时光库里的目录 */
export function checkMoment(moment, dir) {
  const problems = [];
  const say = (where, text) => problems.push(`${moment.id} ${where}：${text}`);
  const add = `npm run moment:add -- ${moment.id} <照片或原片>`;

  if (!ID.test(moment.id)) say("id", "目录名只能用小写字母、数字和短横线，且以字母开头");
  for (const key of ["title", "about"]) {
    if (typeof moment[key] !== "string" || !moment[key].trim()) say(key, "不能空着");
    else if (chars(moment[key]) > LIMITS[key]) say(key, `超过 ${LIMITS[key]} 个字`);
  }

  const day = moment.when?.date ?? "";
  if (!isDay(day)) say("时间", "when.date 要写发生的那天，格式 YYYY-MM-DD");
  else if (Date.parse(day) > Date.now() + 86400000) say("时间", `${day} 还没到`);
  if (moment.when?.label && chars(moment.when.label) > LIMITS.label) say("时间", `when.label 不超过 ${LIMITS.label} 个字`);

  for (const key of ["story", "work"]) {
    if (moment[key] !== undefined && !ID.test(moment[key])) say(key, `写${key === "story" ? "漫画书里故事" : "画廊里作品"}的 id，比如 wrong-museum`);
  }

  const blocks = moment.blocks;
  if (!Array.isArray(blocks) || !blocks.length) {
    say("图文", `blocks 还是空的，先 ${add}`);
  } else {
    if (blocks.length > LIMITS.blocks) say("图文", `最多 ${LIMITS.blocks} 段`);
    const media = (name, pattern) => {
      const video = pattern === VIDEO_FILE;
      if (typeof name !== "string" || !pattern.test(name)) return say("图文", `「${name}」不是${video ? "视频" : "照片"}的文件名（${video ? "02.mp4" : "01.jpg"} 这样）`);
      const file = join(dir, name);
      if (!existsSync(file)) return say("媒体", `找不到 ${name}，${add}`);
      for (const p of video ? videoIssues(readFileSync(file)) : photoIssues(readFileSync(file))) say("媒体", `${name} ${p}`);
    };
    blocks.forEach((b, i) => {
      const where = `第 ${i + 1} 段`;
      const kind = b && typeof b === "object" ? blockKind(b) : null;
      if (!kind) return say("图文", `${where}只能是 photos、video、text、said 里的一种`);
      if ("caption" in b && (kind === "text" || kind === "said")) say("图文", `${where}：caption 只跟在照片和视频后面`);
      if (b.caption !== undefined && (typeof b.caption !== "string" || chars(b.caption) > LIMITS.caption)) say("图文", `${where}：caption 不超过 ${LIMITS.caption} 个字`);
      if (kind === "photos") {
        if (!Array.isArray(b.photos) || !b.photos.length || b.photos.length > LIMITS.photos) return say("图文", `${where}：photos 放 1～${LIMITS.photos} 张`);
        b.photos.forEach((p) => media(p, PHOTO_FILE));
      } else if (kind === "video") {
        media(b.video, VIDEO_FILE);
        if (VIDEO_FILE.test(b.video ?? "")) media(posterOf(b.video), /^\d{2}\.poster\.jpg$/);
      } else if (typeof b[kind] !== "string" || !b[kind].trim()) {
        say("图文", `${where}：${kind} 不能空着`);
      } else if (chars(b[kind]) > LIMITS[kind]) {
        say("图文", `${where}：${kind === "said" ? "小念的原话" : "这段话"}超过 ${LIMITS[kind]} 个字`);
      }
    });
    const files = mediaFiles(moment);
    if (!files.length) say("图文", `至少要有一张照片或一段视频，${add}`);
    if (moment.cover !== undefined && !(files.includes(moment.cover) && moment.cover.endsWith(".jpg"))) say("封面", `cover 写这个瞬间里一张照片或视频封面的文件名`);
    // 换过照片、剪过两遍留下的旧文件，或者原片误放进来
    const extra = existsSync(dir) ? readdirSync(dir).filter((n) => !files.includes(n) && !KEEP.includes(n)) : [];
    if (extra.length) say("媒体", `目录里多出 ${extra.join("、")}，用不上就删掉（原片放别处）`);
  }

  if (!existsSync(join(dir, "notes.md"))) say("记录", "缺 notes.md");
  return problems;
}

/** library.json：名字、生日、年份卡的照片 */
export function checkProfile(profile, dir, moments) {
  const problems = [];
  const say = (text) => problems.push(`library.json：${text}`);
  if (typeof profile.name !== "string" || !profile.name.trim() || chars(profile.name) > LIMITS.name) say(`name 写名字，不超过 ${LIMITS.name} 个字`);
  if (profile.birthday !== undefined && (!isDay(profile.birthday) || Date.parse(profile.birthday) > Date.now())) say("birthday 写生日，格式 YYYY-MM-DD");
  for (const [year, path] of Object.entries(profile.covers ?? {})) {
    const [id, name] = String(path).split("/");
    const moment = moments.find((m) => m.id === id);
    if (!/^\d{4}$/.test(year)) say(`covers 的键写年份，比如 "2025"`);
    else if (!moment || !mediaFiles(moment).includes(name) || !name.endsWith(".jpg") || !existsSync(join(dir, id, name))) say(`covers.${year} 写「瞬间id/照片文件名」，比如 first-sea/01.jpg`);
    else if (!moment.when?.date?.startsWith(year)) say(`covers.${year} 用的 ${id} 不是 ${year} 年的`);
  }
  return problems;
}

function main() {
  const lib = readLibrary();
  if (lib.problem) {
    console.log(lib.problem);
    return;
  }
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  let failed = 0;
  for (const e of [...lib.errors, ...checkProfile(lib.profile, lib.dir, lib.moments)]) {
    console.error(`✗ ${e}`);
    failed++;
  }
  for (const id of only) {
    if (!lib.moments.some((m) => m.id === id)) {
      console.error(`✗ ${id}：时光库里没有 ${id}/moment.json`);
      failed++;
    }
  }
  for (const moment of lib.moments) {
    if (only.length && !only.includes(moment.id)) continue;
    const problems = checkMoment(moment, join(lib.dir, moment.id));
    if (problems.length) {
      console.error(`✗ ${moment.id}`);
      for (const p of problems) console.error(`  - ${p}`);
      failed++;
    } else {
      console.log(`✓ ${moment.id}`);
    }
  }
  if (!lib.moments.length) console.log(`时光库（${lib.dir}）里还没有瞬间：npm run moment:new -- <id> <照片或原片>`);
  if (failed) process.exit(1);
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) main();
