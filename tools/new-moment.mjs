// 新收一个瞬间：在时光库里建 <id>/moment.json 和 notes.md；给了照片或视频就顺便处理好、接进图文。
// 用法：
//   npm run moment:new -- <id> [照片或原片…]
//   npm run moment:new -- <id> <原片> [--from 0:12.5] [--to 0:41] [--poster 0:20] [--mute]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addMedia, checkSources } from "./add-media.mjs";
import { ID, requireLibrary } from "./library.mjs";
import { parseArgs } from "./video.mjs";

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [id, ...sources] = opts.positional;
  if (!id || !ID.test(id)) throw new Error("用法：npm run moment:new -- <id> [照片或原片…] [--from --to --poster --mute]（id 用小写字母、数字、短横线）");
  const dir = join(requireLibrary(), id);
  if (existsSync(join(dir, "moment.json"))) throw new Error(`已存在：${join(dir, "moment.json")}；往里加用 npm run moment:add`);

  // 素材不对就什么都不建，免得留下半个瞬间
  const shotOn = await checkSources(sources, opts);
  const date = shotOn ?? new Date().toLocaleDateString("sv-SE");

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "notes.md"), `# ${id}

## 那天的事（${date}${shotOn ? "，原片里读出来的拍摄日，跟大人核对一下" : ""}）

- 

## 小念说

- 

## 剪辑

`);
  writeFileSync(join(dir, "moment.json"), JSON.stringify({ title: "新的瞬间", about: "那天发生了什么。", when: { date }, blocks: [] }, null, 2) + "\n");
  console.log(`已创建 ${dir}`);

  if (!sources.length) {
    console.log(`还没有照片或视频：npm run moment:add -- ${id} <照片或原片…>`);
    return;
  }
  try {
    const added = await addMedia(dir, sources, opts);
    console.log(`加好了：${added.join("、")}`);
  } catch (err) {
    throw new Error(`没处理好：${err.message}\n目录已经建好了，修好后跑 npm run moment:add -- ${id} <照片或原片>`);
  }
  console.log(`下一步：写 moment.json（标题、那天的事、每段的说明）→ npm run check -- ${id} → npm run snapshot -- home ${id}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
