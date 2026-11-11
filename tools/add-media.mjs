// 往一个图集里加照片和视频：处理好、按顺序编号（01.jpg、02.mp4 + 02.poster.jpg……），
// 一个一段接到 moment.json 的 blocks 后面；说明（caption）、并排、文字段留给大人和 agent 再改。
// 用法：
//   npm run album:add -- <id> <照片或原片> [更多照片…]
//   npm run album:add -- <id> <原片> --from 0:12.5 --to 0:41 [--poster 0:20] [--mute]   剪辑参数只配一段视频
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ID, libraryDir } from "./library.mjs";
import { processPhoto, sourceMime } from "./photo.mjs";
import { parseArgs, planClip, probe, processVideo, VIDEO_EXTENSIONS } from "./video.mjs";

const isVideo = (file) => VIDEO_EXTENSIONS.includes(extname(file).toLowerCase());

/** 下一个编号：目录里最大的两位数编号 + 1 */
export function nextNumber(dir) {
  const used = existsSync(dir) ? readdirSync(dir).map((n) => /^(\d{2})\./.exec(n)?.[1]).filter(Boolean).map(Number) : [];
  return Math.max(0, ...used) + 1;
}

/** 先全部核对一遍再动手，免得加了一半；返回视频的拍摄日（第一段读得出来的） */
export async function checkSources(sources, { from, to, poster, mute } = {}) {
  const clipping = from !== undefined || to !== undefined || poster !== undefined || mute;
  if (clipping && (sources.length !== 1 || !isVideo(sources[0]))) throw new Error("--from --to --poster --mute 只能配一段视频，一次加一段");
  let shotOn = null;
  for (const src of sources) {
    if (isVideo(src)) {
      const info = await probe(resolve(src));
      planClip({ duration: info.seconds, from, to, poster });
      shotOn ??= info.date;
    } else {
      sourceMime(resolve(src));
    }
  }
  return shotOn;
}

/** 处理好放进 dir，接到 moment.json 后面，返回加上的文件名 */
export async function addMedia(dir, sources, opts = {}) {
  await checkSources(sources, opts);
  const file = join(dir, "moment.json");
  const moment = JSON.parse(readFileSync(file, "utf8"));
  const blocks = Array.isArray(moment.blocks) ? [...moment.blocks] : [];
  let n = nextNumber(dir);
  if (n + sources.length > 100) throw new Error("一个图集最多 99 个文件，挑一挑，或者分成两个图集");
  const added = [];
  for (const src of sources) {
    const name = String(n++).padStart(2, "0");
    if (isVideo(src)) {
      await processVideo(src, { ...opts, dir, name });
      blocks.push({ video: `${name}.mp4` });
      added.push(`${name}.mp4`, `${name}.poster.jpg`);
    } else {
      await processPhoto(resolve(src), { dir, name: `${name}.jpg` });
      blocks.push({ photos: [`${name}.jpg`] });
      added.push(`${name}.jpg`);
    }
    // 每处理好一个就写一次，中途出错也不丢已经做好的
    writeFileSync(file, JSON.stringify({ ...moment, blocks }, null, 2) + "\n");
  }
  return added;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [id, ...sources] = opts.positional;
  if (!id || !ID.test(id) || !sources.length) throw new Error("用法：npm run album:add -- <id> <照片或原片> [更多…] [--from --to --poster --mute]");
  const dir = join(libraryDir(), id);
  if (!existsSync(join(dir, "moment.json"))) throw new Error(`还没有这个图集：npm run album:new -- ${id}`);
  if (sources.some(isVideo)) console.log("剪辑中，长一点的要等一会儿…");
  const added = await addMedia(dir, sources, opts);
  console.log(`加好了：${added.join("、")}`);
  console.log(`下一步：在 moment.json 里给它们写 caption、把相关的照片并排（photos 放 2～3 张）、加 text 和 said → npm run check -- ${id}`);
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
