// 演示时光库：用 ffmpeg 现场画照片、画几段视频（都是假的，没有家里的东西），排成一篇篇图文，
// 放进 demo/library（明文）并加密进 demo/vault，然后用它打开网站。都在 demo/ 下，进 git（换台电脑不用 ffmpeg 也能直接打开）；不动 .env.local。
//
//   npm run demo               没有就生成，然后打开（密码打印在终端里）
//   npm run demo -- --fresh    重新生成
//   npm run demo -- --no-open  只生成，不打开
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./library.mjs";
import { PHOTO, photoIssues } from "./photo.mjs";
import { report, sealLibrary } from "./seal.mjs";
import { processVideo, run } from "./video.mjs";
import { mediaFiles } from "../src/moment/vocab.ts";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const DEMO = join(root, "demo");
const LIBRARY = join(DEMO, "library");
const VAULT = join(DEMO, "vault");
export const DEMO_PASSWORD = "xiaonian-demo-2026";

const PROFILE = { name: "小念", birthday: "2022-09-08", covers: { "2024": "birthday-2/01.jpg", "2025": "birthday-3/01.jpg" } };

/** [id, 日子, 标题, 那天的事, 小念说, 那天是什么日子] */
const PHOTO_MOMENTS = [
  ["hello", "2022-09-08", "你好呀", "出生那天，哭了一声就睡着了，小手一直攥着。", undefined, "出生"],
  ["first-tooth", "2023-03-10", "长第一颗牙", "下面冒出一颗小白牙，啃什么都要先咬一口。"],
  ["first-birthday", "2023-09-08", "一岁生日", "抓周抓了一支蜡笔，抓起来就往嘴里放。", undefined, "生日"],
  ["first-steps", "2024-02-18", "迈出第一步", "扶着沙发松开手，自己走了三步才坐下。"],
  ["first-word", "2024-04-03", "第一次叫爸爸", "早上醒来对着爸爸喊了一声，全家都愣住了。", "爸爸！"],
  ["spring-kite", "2024-04-14", "看放风筝", "在河边看大哥哥放风筝，追着线跑。"],
  ["dragon-boat", "2024-06-10", "端午包粽子", "抓着糯米往粽叶里塞，塞得满桌都是。", undefined, "端午节"],
  ["summer-pool", "2024-07-20", "戏水池", "第一次下儿童泳池，抱着游泳圈不撒手。"],
  ["birthday-2", "2024-09-08", "两岁生日", "对着蛋糕吹了三次才吹灭蜡烛。", "再点一次！", "生日"],
  ["moon-2024", "2024-09-17", "看月亮", "在阳台上找月亮，说月亮跟着我们走。", "月亮在跟着我！", "中秋节"],
  ["first-snow", "2024-12-15", "第一场雪", "伸手接雪花，看着它在手心化掉。"],
  ["fireworks-2025", "2025-01-29", "过年看烟花", "捂着耳朵看烟花，又一直喊还要看。", undefined, "春节"],
  ["first-sea", "2025-03-15", "第一次看海", "第一次看到大海，站在沙滩上不肯走，说海是会呼吸的。", "海在呼气，又在吸气！", "春游"],
  ["sunflower-seeds", "2025-04-05", "种向日葵", "在阳台花盆里埋下种子，每天早上去看一眼。"],
  ["zoo", "2025-05-01", "去动物园", "在长颈鹿前面站了很久，学它伸脖子。", "它的脖子是滑梯！"],
  ["eat-by-myself", "2025-06-15", "自己吃饭", "第一次不要人喂，自己用勺子吃完一碗饭。"],
  ["birthday-3", "2025-09-08", "三岁生日", "收到一辆小自行车，晚上非要放在床边。", undefined, "生日"],
  ["autumn-leaves", "2025-10-26", "捡树叶", "在公园捡了一口袋黄叶子，说要做书签。"],
  ["family-drawing", "2025-11-20", "画全家福", "画了三个圆圈，说这是爸爸妈妈和我。", "最小的这个是我。"],
  ["christmas-tree", "2025-12-25", "自己挂的彩灯", "第一次自己往圣诞树上挂彩灯，够不着的让爸爸抱起来挂。", undefined, "圣诞节"],
  ["couplets", "2026-02-17", "贴春联", "踩着小凳子帮忙按住春联的一角。", undefined, "春节"],
  ["no-training-wheels", "2026-03-21", "自己骑车", "去掉辅助轮，在广场上骑了一整圈。", "我不用扶了！"],
  ["block-tower", "2026-05-10", "搭积木塔", "搭了一座比自己还高的积木塔。"],
  ["childrens-day", "2026-06-01", "六一儿童节", "去美术馆看展，结果走错了馆，却在另一个馆里画了京剧脸谱。", undefined, "六一儿童节"],
  ["sand-river", "2026-07-18", "海边挖沙", "在沙滩上挖了一条河，等海水流进来。"],
  ["birthday-4", "2026-09-08", "四岁生日", "自己切蛋糕，给每个人分了一块。", undefined, "生日"],
  ["mooncake", "2026-09-25", "做月饼", "用模具压月饼，压出来一只小兔子。", undefined, "中秋节"],
  ["school-show", "2026-10-30", "幼儿园表演", "在台上唱了一首歌，唱完还鞠了一躬。"],
  ["swim-class", "2026-11-01", "第一节游泳课", "敢把脸埋进水里了，出来时一直在笑。"],
];

/** 有视频的瞬间：先生成一段「原片」（带拍摄时间，竖拍的带旋转标记），再按 clip 剪 */
const VIDEO_MOMENTS = [
  ["bubbles", "2025-08-08", "吹泡泡", "小区楼下吹泡泡，一口气吹出一大串，追着跑了好几圈。", undefined, "立秋",
    { lavfi: "gradients=s=1920x1080:c0=0xff9f43:c1=0xff6b6b:c2=0x5b8def:c3=0x43b58f:n=4:seed=11:type=radial:speed=0.04:r=30", seconds: 30, sound: 523, clip: { from: 4, to: 16, poster: 8 } }],
  ["puddle-jumping", "2026-04-22", "雨天踩水坑", "穿着新雨鞋专门找水坑踩，一个都没放过。", "这个水坑是最大的！", "下雨天",
    { lavfi: "life=s=480x270:mold=10:r=30:ratio=0.12:death_color=0x9ad0ff:life_color=0x1e6fd9,scale=1920:1080:flags=neighbor", seconds: 24, sound: 330, rotate: 90, clip: { from: 2, to: 14, poster: 5, mute: true } }],
  ["first-day-school", "2026-09-01", "第一天上学", "背着新书包出门，到了路口自己挥手说再见，没有回头。", "我自己进去就行。", "开学",
    { lavfi: "mandelbrot=s=640x360:maxiter=300:end_scale=0.05:rate=30,scale=1280:720", seconds: 20, sound: 440, clip: { from: 3, to: 18, poster: 10 } }],
];

const CAPTIONS = ["刚到的时候", "一转眼就跑远了", "回头冲我们笑", "这张是爸爸拍的", "累了也不肯走", "最后一张，回家啦"];
const PALETTE = ["0xff9f43", "0xff6b6b", "0x5b8def", "0x43b58f", "0xffd166", "0xef476f", "0x06d6a0", "0x118ab2", "0xc77dff", "0xf4a261"];
const SHAPES = ["2400x1800", "1536x2048", "2048x2048", "1800x2400"];

const gradient = (seed, shape) => {
  const c = (k) => PALETTE[(seed * 3 + k * 7) % PALETTE.length];
  return `gradients=s=${shape}:c0=${c(0)}:c1=${c(1)}:c2=${c(2)}:n=3:seed=${100 + seed}:type=${seed % 5},vignette=PI/5`;
};

/** 一篇图文：照片一张大的、两张并排、文字、原话穿插着排 */
function plan(entry, i) {
  const [id, date, title, about, said, label, video] = entry;
  const photos = 2 + (i % 3);
  const name = (n) => `${String(n).padStart(2, "0")}.jpg`;
  const blocks = [];
  let n = 1;
  if (video) {
    blocks.push({ video: "01.mp4", caption: CAPTIONS[i % CAPTIONS.length] });
    n++;
  } else {
    blocks.push({ photos: [name(n++)], caption: CAPTIONS[i % CAPTIONS.length] });
  }
  blocks.push({ text: `（演示）这里写一段那天的事：在哪儿、和谁、发生了什么好玩的。画面是 ffmpeg 画的，换成真的照片就是一篇小小的图文。` });
  if (said) blocks.push({ said });
  const rest = photos - (video ? 0 : 1);
  if (rest >= 2) blocks.push({ photos: [name(n++), name(n++)], caption: CAPTIONS[(i + 1) % CAPTIONS.length] });
  if (rest % 2) blocks.push({ photos: [name(n++)], caption: CAPTIONS[(i + 2) % CAPTIONS.length] });
  const moment = { title, about, when: { date, ...(label && { label }) }, blocks };
  if (id === "childrens-day") Object.assign(moment, { work: "opera-mask", story: "wrong-museum" });
  return { id, moment, video, photoNames: blocks.flatMap((b) => b.photos ?? []) };
}

const notes = (id, moment) => `# ${id}

## 那天的事（${moment.when.date}）

- 演示素材：画面是 ffmpeg 生成的，没有家里的照片和视频

## 剪辑

`;

async function generate() {
  const all = [...PHOTO_MOMENTS, ...VIDEO_MOMENTS].map(plan);
  mkdirSync(LIBRARY, { recursive: true });
  writeFileSync(join(LIBRARY, "library.json"), JSON.stringify(PROFILE, null, 2) + "\n");
  const scratch = mkdtempSync(join(tmpdir(), "kid-growth-demo-"));
  try {
    for (const [i, { id, moment, video, photoNames }] of all.entries()) {
      const dir = join(LIBRARY, id);
      const json = JSON.stringify(moment, null, 2) + "\n";
      if (mediaFiles(moment).every((f) => existsSync(join(dir, f)))) {
        writeFileSync(join(dir, "moment.json"), json);
        continue;
      }
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "notes.md"), notes(id, moment));
      for (const [k, name] of photoNames.entries()) {
        const shape = moment.blocks.some((b) => b.photos?.length === 2 && b.photos.includes(name)) ? "2048x2048" : SHAPES[(i + k) % SHAPES.length];
        await run(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", gradient(i * 5 + k, shape), "-frames:v", "1",
          "-vf", `scale='min(iw,${PHOTO.targetSide})':'min(ih,${PHOTO.targetSide})':force_original_aspect_ratio=decrease`, "-q:v", "4", join(dir, name)]);
        const problems = photoIssues(readFileSync(join(dir, name)));
        if (problems.length) throw new Error(`${id}/${name}：${problems.join("；")}`);
      }
      if (video) {
        const { lavfi, seconds, sound, rotate, clip } = video;
        const flat = join(scratch, `${id}-flat.mp4`);
        const raw = join(scratch, `${id}.mov`);
        await run(FFMPEG, [
          "-v", "error", "-y", "-f", "lavfi", "-i", lavfi, "-f", "lavfi", "-i", `sine=frequency=${sound}:sample_rate=48000`,
          "-t", String(seconds), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac",
          "-metadata", `creation_time=${moment.when.date}T02:00:00Z`, flat,
        ]);
        await run(FFMPEG, ["-v", "error", "-y", ...(rotate ? ["-display_rotation:v:0", String(rotate)] : []), "-i", flat, "-c", "copy", "-map_metadata", "0", raw]);
        await processVideo(raw, { ...clip, dir, name: "01" });
      }
      writeFileSync(join(dir, "moment.json"), json);
      console.log(`✓ ${id}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
// 旧版演示（一张图一个瞬间）的目录结构不一样，整个重来
if (args.includes("--fresh") || !existsSync(LIBRARY)) rmSync(DEMO, { recursive: true, force: true });
if (!existsSync(LIBRARY)) console.log("生成演示时光库（要一分钟左右）…");
await generate();
const result = await sealLibrary({ library: LIBRARY, vault: VAULT, password: DEMO_PASSWORD, init: true });
console.log(report(result));
if (result.skipped.length) process.exit(1);

if (!args.includes("--no-open")) {
  Object.assign(process.env, { MOMENTS_DIR: LIBRARY, VAULT_DIR: VAULT, TIMELINE_PASSWORD: DEMO_PASSWORD });
  const { createServer } = await import("vite");
  const server = await createServer({ root });
  await server.listen();
  server.printUrls();
  console.log(`  ➜  演示密码：${DEMO_PASSWORD}`);
}
