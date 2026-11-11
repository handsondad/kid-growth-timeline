// 成长节点：starter/ 里是规划好的一件件事（出生、回家、满月、百天……），只有标题、日子、文字，没有照片。
// 它进 git、是公开的明文；npm run starter 把它复制进 albums/，再往里 npm run album:add 加照片。
// 照片、视频、小念的原话（said）只放 albums/，不写进 starter/。
//
//   npm run starter        albums/ 里还没有的节点复制进去；已经有的不动
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ID, libraryDir, libraryProblem, PROFILE_FILE, root } from "./library.mjs";

export const STARTER = join(root, "starter");

/** 复制进 albums/，返回复制了的、本来就有的节点 */
export function copyStarter({ from = STARTER, library = libraryDir() } = {}) {
  mkdirSync(library, { recursive: true });
  const problem = libraryProblem(library);
  if (problem) throw new Error(problem);
  const copied = [];
  const kept = [];
  if (!existsSync(join(library, PROFILE_FILE))) copyFileSync(join(from, PROFILE_FILE), join(library, PROFILE_FILE));
  for (const id of readdirSync(from)) {
    if (!ID.test(id) || !existsSync(join(from, id, "moment.json"))) continue;
    const dir = join(library, id);
    if (existsSync(join(dir, "moment.json"))) {
      kept.push(id);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    for (const name of ["moment.json", "notes.md"]) copyFileSync(join(from, id, name), join(dir, name));
    copied.push(id);
  }
  return { library, copied, kept };
}

function main() {
  const { library, copied, kept } = copyStarter();
  console.log(`albums：${library}`);
  console.log(`复制了 ${copied.length} 个节点${copied.length ? `：${copied.join("、")}` : ""}${kept.length ? `；已经有的没动：${kept.join("、")}` : ""}`);
  console.log("下一步：npm run album:add -- <id> <照片或原片…> 加照片，改 moment.json 里的日子和文字 → npm run check -- <id>");
  console.log("还没有照片的节点不会加密进 vault，页面上也不显示，加了照片才挂上绳子。用不上的节点整个文件夹删掉。");
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
