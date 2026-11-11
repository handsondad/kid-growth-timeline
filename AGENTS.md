# AGENTS.md：给接手这个仓库的代码助手

## 这是什么

「小念的成长时光轴」：小念长大路上的照片和小视频，按发生的日子夹在一根晾衣绳上。首页每一年收成一张年份卡（一张照片 + 那年几岁），点开一年，那一年的瞬间在绳子上左右滑着看；点一个「看详情」，是那天的一篇图文：几张照片、一段小视频、大人写的话、小念的原话。

**照片和视频是加密了才进 git 的。** 明文的照片、视频和每个瞬间的数据放在仓库外面的一个文件夹里，叫**时光库**，不进 git；`npm run seal` 把它加密成仓库里的 `vault/`，只有 `vault/` 提交、随 GitHub Pages 发布。页面上输入密码，在浏览器里解开。密码只在 `.env.local` 和大人脑子里。

用的时候：`npm run library -- <时光库>` 指定一次，在 `.env.local` 里写 `TIMELINE_PASSWORD=…`，`npm run dev` 打开浏览器（开着的时候时光库一改就自动加密、页面自己刷新）。要发布：`git add vault && git commit && git push`，CI 构建后发布到 https://handsondad.github.io/kid-growth-timeline/ 。

**剪视频不在网页里做。** 原片交给 agent，在后台用 `npm run video` 看信息、截帧，挑一段，`npm run moment:add` 剪好压好放进时光库；网页只负责播放。

和《小念的画廊》（[kids-gallery](https://github.com/handsondad/kids-gallery)）、《小念家的漫画书》（[storyverse](https://github.com/handsondad/storyverse)）是同一个系列：同一个小念，同一套颜色、字体和首页晾衣绳。同一天在画廊里有作品、在漫画书里有故事的，详情页会链过去。

技术栈：React 18 + TypeScript（strict）+ Vite 5。Hash 路由。加密：Argon2id（hash-wasm）+ WebCrypto 的 AES-256-GCM。

**收新瞬间之前，先读 `skills/kid-growth-curate/SKILL.md`；有视频的，再读 `skills/kid-growth-video/SKILL.md`。**

## 时光库（明文，不进 git）

```
<时光库>/
  library.json         { "name": "小念", "birthday": "2022-09-08", "covers": { "2025": "first-sea/01.jpg" } }
  first-bike/          一个瞬间一个目录，目录名就是 id（小写字母、数字、短横线）
    moment.json        这个瞬间的数据（类型见 src/moment/types.ts，不写 id）
    notes.md           那天的事、小念的原话、剪辑记录；不进页面，也不加密进 vault
    01.jpg 02.jpg      照片（moment:add 处理好、编好号）
    03.mp4             视频 + 03.poster.jpg 封面
```

`moment.json` 的 `blocks` 是详情页从上往下的一段一段，每段只能是一种：`{ "photos": ["01.jpg", "02.jpg"], "caption": "…" }`（1～3 张并排）、`{ "video": "03.mp4", "caption": "…" }`、`{ "text": "…" }`（大人写的，≤300 字）、`{ "said": "…" }`（小念原话，≤40 字）。

- 位置：环境变量 `MOMENTS_DIR`，没有就读 `.env.local` 里的 `MOMENTS_DIR=`（`npm run library -- <路径>` 写的）
- 一般放在仓库外面（比如 `D:/小念/时光轴`）；想放在仓库里只能放 `library/`（已被忽略）。放在仓库里又没被忽略的，工具会拒绝
- 原片不放时光库，放 `private/` 或者家里原来的相册目录；时光库里只放处理好的
- **时光库要另外备份**：vault 只是加密的拷贝，密码忘了就解不开

## vault（加密，进 git、发布到网上）

```
vault/
  key.json        随机主钥匙，被「密码 → Argon2id」得到的钥匙包着
  index.enc       所有瞬间的数据（加密的 JSON：profile、years、moments，每个文件记成 blobs 里的名字）
  blobs/<32位hex>  每张照片、视频、缩略图各一个，按 1 MB 分块 AES-GCM 加密
```

- 代码：`src/vault/crypto.ts`（浏览器和 Node 共用）、`tools/seal.mjs`（加密）、`src/library.ts`（页面解开）
- 文件名是主钥匙算出来的 HMAC：同样的内容名字不变，没改的文件不重写，git 里不会无故变大；看不出是哪张照片
- 检查不过的瞬间不加密，`npm run seal` 会列出来
- 密码：`.env.local` 的 `TIMELINE_PASSWORD=`（或环境变量），至少 12 位。页面上「记住我」把解开的钥匙存在那台设备的浏览器里，换密码后要重新输
- 位置：默认仓库里的 `vault/`；`VAULT_DIR` 可以换（演示用 `demo/vault`）

## 命令

需要 Node.js 22+。测试和脚本直接用 Node 跑 `.ts` 文件。

| 命令 | 作用 |
|---|---|
| `npm run library [-- <路径>]` | 看现在用的时光库 / 换一个；顺便告诉你 vault 在哪、密码设了没有 |
| `npm run dev` | 开发服务器，自动打开浏览器；时光库里加了、改了瞬间会自动加密、自己刷新（`KGT_AUTOSEAL=0` 关掉） |
| `npm run demo [-- --fresh] [--no-open]` | 生成演示时光库 `demo/library` 并加密到 `demo/vault`（ffmpeg 画的假素材，git 忽略），用它打开，不改 `.env.local`；密码打印在终端里 |
| `npm run seal [-- --init]` | 把时光库加密进 `vault/`；第一次加 `--init` 生成钥匙 |
| `npm run seal -- --new-password` / `--rotate` | 换密码（新密码放在环境变量 `TIMELINE_NEW_PASSWORD`）/ 密码泄露了，连主钥匙一起换、全部重新加密 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | 全部测试（不需要时光库；装了 ffmpeg 会真剪一段测试视频） |
| `npm run check [-- <id>]` | 检查时光库里的 library.json、每个瞬间的内容、照片和视频 |
| `npm run moment:new -- <id> [照片或原片…] [剪辑参数]` | 新收一个瞬间（建目录，照片、视频处理好接进 blocks） |
| `npm run moment:add -- <id> <照片或原片…> [剪辑参数]` | 往瞬间里加照片、视频：照片转正、缩到长边 1600、去掉拍摄信息；视频剪好压成 720p，编号接在后面 |
| `npm run video -- --info <原片>` | 看原片：时长、尺寸、拍摄日、有没有声音和位置 |
| `npm run video -- --frames <原片或id/NN> [--every 2] [--from] [--to]` | 截帧拼成一张图，放 `private/frames/`，用来挑起止点 |
| `npm run snapshot [-- home 2025 <id>...] [--width 390]` | 用密码解锁后截成 PNG，放在 `snapshots/`；顺便真的解密、解码一下每段视频 |
| `npm run build` / `npm run preview` | 构建到 `dist/`（页面 + 复制进去的 vault，没有明文），用 preview 打开 |

剪辑参数：`--from 0:12 --to 0:40 [--poster 0:21] [--mute]`，只配一段视频。

改代码交付前要过：`npm run typecheck`、`npm test`、`npm run build`。收了新瞬间还要 `npm run check`、`npm run seal`，`npm run snapshot` 自己看一遍图，手机宽度（`--width 390`）也看。

## 地图

| 路由 | 页面 | 文件 |
|---|---|---|
| （没解锁） | 输密码 | `src/pages/LockPage.tsx` |
| `#/`、`#/year/<年>`、`#/at/<id>` | 首页时间绳：年份卡，点开一年左右滑（位置在 `src/pages/timeline.ts`）；点一个，下面出预览，「看详情」 | `src/pages/WallPage.tsx` |
| `#/moment/<id>` | 详情：一篇图文，点照片看大图，视频点了才下载解密；← → 换一个 | `src/pages/MomentPage.tsx` |

代码和工具：

- `src/App.tsx`：读 `vault/key.json` → 输密码（或用记住的钥匙）→ 解开 `index.enc` → 路由
- `src/library.ts`：解锁、记住钥匙、下载解密 blob（照片有缓存，视频带进度）
- `src/pages/VaultMedia.tsx`：加密的照片（滚到跟前才解）、加密的视频（封面 → 点了下载解密 → 播放）
- `src/moment/types.ts`、`src/moment/vocab.ts`：瞬间、图文段落、vault 目录的类型，文件名规则
- `src/vault/crypto.ts`：钥匙、加密解密、文件名
- `tools/library.mjs`：找时光库和 vault、读 `.env.local`、读瞬间、`npm run library`
- `tools/seal.mjs`：加密时光库，缩略图（360×360，ffmpeg 做），删掉用不上的 blob
- `tools/vite-library.mjs`：Vite 插件，开发时只给 `vault/` 下的三种文件（支持分段）并自动加密，构建时把 vault 复制进 `dist/`
- `tools/photo.mjs`：用本机浏览器的画布重画照片，顺便去掉 Exif；也给检查器读 JPEG/PNG
- `tools/video.mjs`：调 ffmpeg 看原片、截帧、剪辑、截封面；也给检查器读 MP4（纯 JS）
- `tools/add-media.mjs`、`tools/new-moment.mjs`、`tools/snapshot.mjs`、`tools/demo.mjs`
- `tests/moment-rules.mjs`：内容检查器；`tests/fixtures.mjs`：测试用的假时光库
- `.github/workflows/ci.yml`：检查、构建，main 上发布到 GitHub Pages
- `public/fonts/timeline.woff2`：完整的站酷快乐体（OFL），不截子集

旧的 Nuxt + SQLite 版本（网页里导入、裁剪视频的后台队列）在提交 `f060b94` 及之前的历史里。

## 收一个新瞬间

1. `npm run library` 确认时光库是对的、密码设了
2. 原片、原图放 `private/`（或者直接用家里相册里的路径）
3. 视频先 `npm run video -- --info` 和 `--frames`，看截帧图挑一段（见 video skill）
4. `npm run moment:new -- <id> <照片…>`，或者 `npm run moment:new -- <id> <原片> --from 0:12 --to 0:40`；再加用 `npm run moment:add`
5. 问大人那天的事，记进 `notes.md`，写 `moment.json`（标题、那天的事、每段的说明、并排、文字、原话），跑 `npm run check -- <id>` 直到通过
6. `npm run seal`，`npm run snapshot -- home <年> <id>` 和 `--width 390`，打开 `snapshots/` 看图
7. 大人说好了，`git add vault && git commit`，推上去就发布了

## 硬性规矩

- **明文不进 git**：真实的照片、视频、`moment.json`、`notes.md`、`library.json` 只写进时光库，进 git 的只有 `vault/`。测试里用工具现场生成的假素材。`dist/`、`snapshots/`、`private/`、`demo/`、`library/` 都已被忽略，不要改 `.gitignore` 把它们放出来。`notes.md` 不加密进 vault。
- **密码不进 git**：不写进代码、提交信息、PR、日志、截图和测试里（测试和演示用固定的假密码）。只放 `.env.local` 或环境变量。
- **加密别削弱**：不要调低 `src/vault/crypto.ts` 里 Argon2id 的强度、不要缩短密码下限、不要在 vault 外面放能看出内容的东西（缩略图、文件名、标题都在加密的 index 里）。改加密格式要能读旧的，或者让大人跑 `--rotate`。
- **发布**：只发布 GitHub Pages（CI 里自动），发出去的是页面和 vault。开发和预览服务器只听 `127.0.0.1`，不要改成 `0.0.0.0`；别的地方要发布，先问大人。
- **先压缩再加密**：密文压不小，所以体积在 `moment:add` 那一步就定了：照片长边 1600、JPEG 质量 0.82（`PHOTO` 在 `tools/photo.mjs`），视频长边 1280、码率封顶 2 Mbps（`CLIP`、`encodeArgs` 在 `tools/video.mjs`），一张照片三五百 KB、一分钟视频十几 MB。推上去的旧版本会一直留在历史里，不要动不动就调参数重压整个时光库。
- **只挑最好的一段**：一段视频不超过 180 秒、90 MB（GitHub 单个文件上限 100 MB；`CLIP` 在 `tools/video.mjs`）。原片不要整个搬进时光库。整个 vault 不要超过 1 GB（Pages 的上限，`npm run seal` 快到了会提示）。
- **小念的原话**：`said` 一字不改；没问到就不写，不要替他编。大人的话写进 `about` 和 `text`。
- **日子**：`when.date` 写发生的那天。`moment:new` 会把原片里读出来的拍摄日填进去，跟大人核对一下；不知道就问，别猜。同一天画廊里有作品写 `work`，漫画书里有故事写 `story`。生日写在 `library.json`，别猜。
- **素材许可**：站酷快乐体是 OFL，hash-wasm 是 MIT；新素材、新依赖要在 `THIRD_PARTY_NOTICES.md` 写明来源。
- **代码风格**：照周围代码写。中文注释只写代码本身表达不了的约束；改动要小而完整。

## 已知的坑

- **密码忘了就没了**：vault 解不开，只能拿时光库重新 `--init`。时光库要备份。
- **git 历史删不掉**：推上去的 vault 一直在历史里。换密码（`--new-password`）只是重新包钥匙，知道旧密码的人还能从旧的 `key.json` 拿到主钥匙；密码真泄露了用 `--rotate`（全部重新加密，仓库变大一倍）。瞬间从时光库删掉，vault 里也删了，但历史里的密文还在。
- **`.ts` 扩展名**：Node 直接跑 `.ts`，所以被测试导入的文件相互导入时要写 `.ts` 扩展名。`tsconfig` 开了 `allowImportingTsExtensions`。
- **页面上写着「还没有加密好的时光库」**：`vault/key.json` 不存在，跑 `npm run seal -- --init`。开发时没设密码不会自动加密，终端会提示。
- **换时光库、换密码要重启 `npm run dev`**。
- **截图和处理照片要用本机 Edge/Chrome**：`puppeteer-core` 不自带浏览器；找不到时设环境变量 `BROWSER_PATH`。开源的 Chromium 解不了 H.264，截图会报「视频放不出来」，用 Edge 或 Chrome。
- **ffmpeg**：要带 ffprobe 和 libx264，7.0 以上（测试里用到 `-display_rotation`）。不在 PATH 里就设 `FFMPEG_PATH`、`FFPROBE_PATH`。没有 ffmpeg 时缩略图直接用原图，页面会慢一些。
- **dist/ 双击打不开**：浏览器不让 `file://` 读 vault，用 `npm run preview`。
- **视频要整段下载解密才能播**：所以有 90 MB 上限；手机流量下点开大视频要等一会儿（有进度）。
- **HEIC 照片**：浏览器解不开，先在手机上导出成 JPG。Live Photo 想要动的，就把那段 MOV 当视频收。
- **iPhone 的 HDR 视频**：剪出来颜色会发灰（`--info` 会提示），先在手机上导出成「兼容性最佳」再剪。
- **删掉、换掉一张照片**：把文件删了、`moment.json` 的 blocks 里也去掉，`npm run check` 会提示多出来或者找不到的文件；新的用 `moment:add` 加（编号接在后面）。
- **GitHub Pages 第一次要打开**：仓库 Settings → Pages → Source 选「GitHub Actions」。
