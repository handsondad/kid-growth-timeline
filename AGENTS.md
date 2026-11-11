# AGENTS.md：给接手这个仓库的代码助手

## 这是什么

「小念的成长时光轴」：小念长大路上的一件件事，每件事做成一个**图集**（几张照片、一段小视频、大人写的话、小念的原话），按发生的日子夹在一根晾衣绳上。首页每一年收成一张年份卡（一张照片 + 那年几岁），点开一年，那一年的图集在绳子上左右滑着看；点一个「看详情」，是那天的一篇图文。

**照片和视频是加密了才进 git 的。** 图集放在项目的 `albums/`（明文，一件事一个文件夹，已被 `.gitignore` 忽略）；`npm run seal` 把它加密成 `vault/`，只有 `vault/` 提交、随 GitHub Pages 发布。页面上输入密码，在浏览器里解开。换台电脑 `npm run unseal` 用密码把 `vault/` 解回 `albums/`。密码只在 `.env.local` 和大人脑子里。

用的时候：`.env.local` 里写 `TIMELINE_PASSWORD=…`，`npm run dev` 打开浏览器（开着的时候 `albums/` 一改就自动加密、页面自己刷新）。要发布：`git add vault && git commit && git push`，CI 构建后发布到 https://handsondad.github.io/kid-growth-timeline/ 。给大人看的完整说明在 `README.md`。

**剪视频不在网页里做。** 原片交给 agent，在后台用 `npm run video` 看信息、截帧，挑一段，`npm run album:add` 剪好压好放进图集；网页只负责播放。

和《小念的画廊》（[kids-gallery](https://github.com/handsondad/kids-gallery)）、《小念家的漫画书》（[storyverse](https://github.com/handsondad/storyverse)）是同一个系列：同一个小念，同一套颜色、字体和首页晾衣绳。同一天在画廊里有作品、在漫画书里有故事的，详情页会链过去。

技术栈：React 18 + TypeScript（strict）+ Vite 5。Hash 路由。加密：Argon2id（hash-wasm）+ WebCrypto 的 AES-256-GCM。代码里图集的类型叫 `Moment`（`src/moment/`），数据文件叫 `moment.json`。

**做图集之前，先读 `skills/kid-growth-curate/SKILL.md`；有视频的，再读 `skills/kid-growth-video/SKILL.md`。**

## albums/（明文，不进 git）

```
albums/
  profile.json         { "name": "小念", "birthday": "2024-01-01", "covers": { "2025": "zoo/01.jpg" } }
  .sealed.json         上次和哪一版 vault 对上了（seal、unseal 写，别手改）
  zoo/                 一个图集一个文件夹，文件夹名就是 id（小写字母、数字、短横线）
    moment.json        这个图集的数据（类型见 src/moment/types.ts，不写 id）
    notes.md           那天的事、小念的原话、剪辑记录；不进页面，但加密进 vault（unseal 能找回）
    01.jpg 02.jpg      照片（album:add 处理好、编好号）
    03.mp4             视频 + 03.poster.jpg 封面
```

`moment.json` 的 `blocks` 是详情页从上往下的一段一段，每段只能是一种：`{ "photos": ["01.jpg", "02.jpg"], "caption": "…" }`（1～3 张并排）、`{ "video": "03.mp4", "caption": "…" }`、`{ "text": "…" }`（大人写的，≤300 字）、`{ "said": "…" }`（小念原话，≤40 字）。

- 位置：默认项目里的 `albums/`；环境变量或 `.env.local` 的 `ALBUMS_DIR=` 可以换。放在项目里又没被 git 忽略的，工具会拒绝
- **起步图集**：本机 `albums/` 里有一套 2024～2026 年的起步图集（`hello` 出生、`hundred-days`、`first-birthday`、`zoo`……），照片、视频是写着「占位照片 · 换成真的」的色块，日子、标题、文字是先填的（`notes.md` 里写着「起步占位的日子」），生日 `2024-01-01` 也是占位的。大人会把它们换成真的，没有 `said`
- 原片不放 `albums/`，放 `private/` 或者家里原来的相册目录；`albums/` 里只放处理好的
- **`albums/` 要另外备份**：vault 是加密的拷贝，密码忘了就解不开

## vault（加密，进 git、发布到网上）

```
vault/
  key.json        随机主钥匙，被「密码 → Argon2id」得到的钥匙包着
  index.enc       所有图集的数据（加密的 JSON：profile、years、moments，每个文件、notes.md 记成 blobs 里的名字）
  blobs/<32位hex>  每张照片、视频、缩略图、notes.md 各一个，按 1 MB 分块 AES-GCM 加密
```

- 代码：`src/vault/crypto.ts`（浏览器和 Node 共用）、`tools/seal.mjs`（加密）、`tools/unseal.mjs`（解回 albums/）、`src/library.ts`（页面解开）
- 文件名是主钥匙算出来的 HMAC：同样的内容名字不变，没改的文件不重写，git 里不会无故变大；看不出是哪张照片
- 检查不过的图集不加密，`npm run seal` 会列出来
- **几台电脑一起做**：`albums/.sealed.json` 记着上次对上的 `index.enc`。vault 被别的电脑更新过（`git pull` 来的）而这台还没 `unseal`，`seal` 会拒绝（不然会把别处做的图集删掉），提示先 `unseal`；`unseal` 只解出本机没有的，两边不一样的列出来不动，等大人选 `unseal -- --force`（用 vault 的）或 `seal -- --force`（用本机的）
- 密码：`.env.local` 的 `TIMELINE_PASSWORD=`（或环境变量），至少 12 位。页面上「记住我」把解开的钥匙存在那台设备的浏览器里，换密码后要重新输
- 位置：默认项目里的 `vault/`；`VAULT_DIR` 可以换（测试用临时目录）

## 命令

需要 Node.js 22+。测试和脚本直接用 Node 跑 `.ts` 文件。

| 命令 | 作用 |
|---|---|
| `npm run status` | 图集在哪、有几个，vault 在哪，密码设了没有 |
| `npm run dev` | 开发服务器，自动打开浏览器；`albums/` 里加了、改了会自动加密、自己刷新（`KGT_AUTOSEAL=0` 关掉） |
| `npm run seal [-- --init] [--force]` | 把 `albums/` 加密进 `vault/`；第一次加 `--init` 生成钥匙；`--force` 用本机的盖掉更新过的 vault |
| `npm run seal -- --new-password` / `--rotate` | 换密码（新密码放在环境变量 `TIMELINE_NEW_PASSWORD`）/ 密码泄露了，连主钥匙一起换、全部重新加密（图集要都在本机、都检查得过） |
| `npm run unseal [-- --force]` | 把 `vault/` 解回 `albums/`：换了电脑、`git pull` 之后 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | 全部测试（不需要 albums/；装了 ffmpeg 会真剪一段测试视频） |
| `npm run check [-- <id>]` | 检查 profile.json、每个图集的内容、照片和视频 |
| `npm run album:new -- <id> [照片或原片…] [剪辑参数]` | 新建一个图集（建文件夹，照片、视频处理好接进 blocks） |
| `npm run album:add -- <id> <照片或原片…> [剪辑参数]` | 往图集里加照片、视频：照片转正、缩到长边 1600、去掉拍摄信息；视频剪好压成 720p，编号接在后面 |
| `npm run video -- --info <原片>` | 看原片：时长、尺寸、拍摄日、有没有声音和位置 |
| `npm run video -- --frames <原片或id/NN> [--every 2] [--from] [--to]` | 截帧拼成一张图，放 `private/frames/`，用来挑起止点 |
| `npm run snapshot [-- home 2025 <id>...] [--width 390]` | 用密码解锁后截成 PNG，放在 `snapshots/`；顺便真的解密、解码一下每段视频 |
| `npm run build` / `npm run preview` | 构建到 `dist/`（页面 + 复制进去的 vault，没有明文），用 preview 打开 |

剪辑参数：`--from 0:12 --to 0:40 [--poster 0:21] [--mute]`，只配一段视频。

改代码交付前要过：`npm run typecheck`、`npm test`、`npm run build`。做了图集还要 `npm run check`、`npm run seal`，`npm run snapshot` 自己看一遍图，手机宽度（`--width 390`）也看。

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
- `src/moment/types.ts`、`src/moment/vocab.ts`：图集、图文段落、vault 目录的类型，文件名规则
- `src/vault/crypto.ts`：钥匙、加密解密、文件名
- `tools/library.mjs`：找 albums/ 和 vault、读 `.env.local`、读图集、`npm run status`
- `tools/seal.mjs`：加密 albums/，缩略图（360×360，ffmpeg 做），删掉用不上的 blob，同步标记
- `tools/unseal.mjs`：把 vault 解回 albums/，不盖掉两边不一样的
- `tools/vite-library.mjs`：Vite 插件，开发时只给 `vault/` 下的三种文件（支持分段）、不给 albums/ 里的任何东西，并自动加密；构建时把 vault 复制进 `dist/`
- `tools/photo.mjs`：用本机浏览器的画布重画照片，顺便去掉 Exif；也给检查器读 JPEG/PNG
- `tools/video.mjs`：调 ffmpeg 看原片、截帧、剪辑、截封面；也给检查器读 MP4（纯 JS）
- `tools/add-media.mjs`（album:add）、`tools/new-moment.mjs`（album:new）、`tools/snapshot.mjs`
- `tests/moment-rules.mjs`：图集检查器；`tests/fixtures.mjs`：测试用的假图集
- `.github/workflows/ci.yml`：检查、构建，main 上发布到 GitHub Pages
- `public/fonts/timeline.woff2`：完整的站酷快乐体（OFL），不截子集

旧的 Nuxt + SQLite 版本（网页里导入、裁剪视频的后台队列）在提交 `f060b94` 及之前的历史里。

## 做一个图集

1. `npm run status` 确认密码设了；刚 `git pull` 过或者换了电脑，先 `npm run unseal`
2. 原片、原图放 `private/`（或者直接用家里相册里的路径）
3. 视频先 `npm run video -- --info` 和 `--frames`，看截帧图挑一段（见 video skill）
4. 新的：`npm run album:new -- <id> <照片…>`，或者 `npm run album:new -- <id> <原片> --from 0:12 --to 0:40`；再加用 `npm run album:add`。换掉起步图集的占位照片：删掉占位文件和对应的 blocks，`album:add` 加真的
5. 问大人那天的事，记进 `notes.md`，写 `moment.json`（标题、那天的事、每段的说明、并排、文字、原话），跑 `npm run check -- <id>` 直到通过
6. `npm run seal`，`npm run snapshot -- home <年> <id>` 和 `--width 390`，打开 `snapshots/` 看图
7. 大人说好了，`git add vault && git commit`，推上去就发布了

## 硬性规矩

- **明文不进 git**：真实的照片、视频、`moment.json`、`notes.md`、`profile.json` 只写进 `albums/`，进 git 的只有 `vault/`。测试里用工具现场生成的假素材。`albums/`、`dist/`、`snapshots/`、`private/` 都已被忽略，不要改 `.gitignore` 把它们放出来，也不要 `git add -f`。
- **密码不进 git**：不写进代码、提交信息、PR、日志、截图和测试里（测试用固定的假密码）。只放 `.env.local` 或环境变量。不要替大人起密码。
- **加密别削弱**：不要调低 `src/vault/crypto.ts` 里 Argon2id 的强度、不要缩短密码下限、不要在 vault 外面放能看出内容的东西（缩略图、文件名、标题、notes 都在加密的 index 和 blobs 里）。改加密格式要能读旧的，或者让大人跑 `--rotate`。
- **别弄丢别处做的图集**：`seal` 报「vault 里的图集比 albums/ 新」时先 `unseal`；`--force` 只在大人选好用哪边之后加。
- **发布**：只发布 GitHub Pages（CI 里自动），发出去的是页面和 vault。开发和预览服务器只听 `127.0.0.1`，不要改成 `0.0.0.0`；别的地方要发布，先问大人。
- **先压缩再加密**：密文压不小，所以体积在 `album:add` 那一步就定了：照片长边 1600、JPEG 质量 0.82（`PHOTO` 在 `tools/photo.mjs`），视频长边 1280、码率封顶 2 Mbps（`CLIP`、`encodeArgs` 在 `tools/video.mjs`），一张照片三五百 KB、一分钟视频十几 MB。推上去的旧版本会一直留在历史里，不要动不动就调参数重压所有图集。
- **只挑最好的一段**：一段视频不超过 180 秒、90 MB（GitHub 单个文件上限 100 MB；`CLIP` 在 `tools/video.mjs`）。原片不要整个搬进 albums/。整个 vault 不要超过 1 GB（Pages 的上限，`npm run seal` 快到了会提示）。
- **小念的原话**：`said` 一字不改；没问到就不写，不要替他编。大人的话写进 `about` 和 `text`。
- **日子**：`when.date` 写发生的那天。`album:new` 会把原片里读出来的拍摄日填进去，跟大人核对一下；不知道就问，别猜。同一天画廊里有作品写 `work`，漫画书里有故事写 `story`。生日写在 `albums/profile.json`，别猜。
- **素材许可**：站酷快乐体是 OFL，hash-wasm 是 MIT；新素材、新依赖要在 `THIRD_PARTY_NOTICES.md` 写明来源。
- **代码风格**：照周围代码写。中文注释只写代码本身表达不了的约束；改动要小而完整。

## 已知的坑

- **密码忘了就没了**：vault 解不开，只能拿本机的 `albums/` 重新 `--init`。`albums/` 要备份。
- **git 历史删不掉**：推上去的 vault 一直在历史里。换密码（`--new-password`）只是重新包钥匙，知道旧密码的人还能从旧的 `key.json` 拿到主钥匙；密码真泄露了用 `--rotate`（全部重新加密，仓库变大一倍）。图集从 albums/ 删掉，vault 里也删了，但历史里的密文还在。
- **`.ts` 扩展名**：Node 直接跑 `.ts`，所以被测试导入的文件相互导入时要写 `.ts` 扩展名。`tsconfig` 开了 `allowImportingTsExtensions`。
- **页面上写着「还没有加密好的图集」**：`vault/key.json` 不存在，跑 `npm run seal -- --init`。开发时没设密码不会自动加密，终端会提示。
- **`npm run dev` 终端里「没有自动加密：vault 里的图集比 albums/ 新」**：别的电脑推过，先 `npm run unseal`。
- **换密码、换 `ALBUMS_DIR` 要重启 `npm run dev`**。
- **截图和处理照片要用本机 Edge/Chrome**：`puppeteer-core` 不自带浏览器；找不到时设环境变量 `BROWSER_PATH`。开源的 Chromium 解不了 H.264，截图会报「视频放不出来」，用 Edge 或 Chrome。
- **ffmpeg**：要带 ffprobe 和 libx264，7.0 以上（测试里用到 `-display_rotation`）。不在 PATH 里就设 `FFMPEG_PATH`、`FFPROBE_PATH`。没有 ffmpeg 时缩略图直接用原图，页面会慢一些。
- **dist/ 双击打不开**：浏览器不让 `file://` 读 vault，用 `npm run preview`。
- **视频要整段下载解密才能播**：所以有 90 MB 上限；手机流量下点开大视频要等一会儿（有进度）。
- **HEIC 照片**：浏览器解不开，先在手机上导出成 JPG。Live Photo 想要动的，就把那段 MOV 当视频收。
- **iPhone 的 HDR 视频**：剪出来颜色会发灰（`--info` 会提示），先在手机上导出成「兼容性最佳」再剪。
- **删掉、换掉一张照片**：把文件删了、`moment.json` 的 blocks 里也去掉，`npm run check` 会提示多出来或者找不到的文件；新的用 `album:add` 加（编号接在后面）。
- **GitHub Pages 第一次要打开**：仓库 Settings → Pages → Source 选「GitHub Actions」。
