# AGENTS.md：这个项目怎么用、怎么开发

给接手这个仓库的人和代码助手。项目介绍见 `README.md`；这里讲怎么做内容、怎么改代码、有哪些规矩。

## 这是什么

「小念的成长时光轴」：小念长大路上的一件件事，每件事做成一个**图集**（几张照片、一段小视频、大人写的话、小念的原话），按发生的日子夹在一根晾衣绳上。首页每一年收成一张年份卡（一张照片 + 那年几岁），点开一年，那一年的图集在绳子上左右滑着看；点一个「看详情」，是那天的一篇图文。

发布在 https://handsondad.github.io/kid-growth-timeline/ ，打开输密码才能看。

和《小念的画廊》（[kids-gallery](https://github.com/handsondad/kids-gallery)）、《小念家的漫画书》（[storyverse](https://github.com/handsondad/storyverse)）是同一个系列：同一个小念，同一套颜色、字体和首页晾衣绳。同一天在画廊里有作品、在漫画书里有故事的，详情页会链过去。

技术栈：React 18 + TypeScript（strict）+ Vite 5，Hash 路由。加密：Argon2id（hash-wasm）+ WebCrypto 的 AES-256-GCM。代码里图集的类型叫 `Moment`（`src/moment/`），数据文件叫 `moment.json`。

**代码助手做图集之前，先读 `skills/kid-growth-curate/SKILL.md`；有视频的，再读 `skills/kid-growth-video/SKILL.md`。**

## 三样东西，分清楚就不会出错

| | 是什么 | 在哪 | 进 git 吗 |
|---|---|---|---|
| **原片** | 手机里拍的原图、原视频，又大又带拍摄地点 | 家里的相册，或者项目里的 `private/` | 不进 |
| **成长节点** | 规划好的一件件事（出生、回家、满月、百天……）：标题、日子、大人的话，没有照片 | 项目里的 `starter/` | 进（公开的明文，只有文字） |
| **图集** | 挑过、压缩好的照片和视频，加上标题、日子、文字。一件事一个文件夹 | 项目里的 `albums/` | **不进**（明文） |
| **vault** | `albums/` 加密后的样子，看不出任何内容 | 项目里的 `vault/` | **进**，发布到网上的就是它 |

`starter/` →（`npm run starter` 复制）→ 原片 → `npm run album:new` / `album:add`（挑、压缩、去掉拍摄信息）→ `albums/` → `npm run seal`（加密）→ `vault/` → `git push` → CI 发布到 GitHub Pages → 网页上输密码，在浏览器里解开。

仓库是公开的，`albums/`、`private/`、`.env.local` 都已被 `.gitignore` 忽略；推上去的只有加密的 `vault/`，安全全靠密码。**剪视频不在网页里做**：原片交给代码助手，在后台用 `npm run video` 看信息、截帧，挑一段，`album:add` 剪好压好；网页只负责播放。

## 第一次：准备好（只做一次）

要装：Node.js 22+、ffmpeg 7+（带 ffprobe 和 libx264）、本机的 Edge 或 Chrome。

```bash
npm install
```

把 `.env.example` 复制成 `.env.local`（不进 git），填上密码。至少 12 位，几个随机的词连起来最好记：

```bash
Copy-Item .env.example .env.local    # macOS / Linux：cp .env.example .env.local
```

```
TIMELINE_PASSWORD=换成你自己的密码
```

`.env.example` 里还列了别的可选设置（图集、vault 放哪，ffmpeg、浏览器的路径），一般不用改。

**密码忘了就再也解不开了**，没有找回的办法。代码助手不要替大人起密码，也不要把密码写进任何文件、提交信息或者回复里。

```bash
npm run starter         # 把规划好的成长节点复制进 albums/（还没有照片）
npm run status          # 图集有几个、vault 在哪、密码设了没有
```

然后照着下面「给成长节点加照片」一个个加照片。有照片的节点检查得过了：

```bash
npm run seal -- --init  # 生成钥匙 vault/key.json，把 albums/ 加密进 vault/
npm run dev             # 浏览器打开，输密码看；开着的时候 albums/ 一改就自动加密、页面自己刷新
git add vault && git commit -m "第一批图集" && git push   # 发布
```

GitHub Pages 第一次要在仓库 Settings → Pages → Source 选「GitHub Actions」（已经开好了）。

### 成长节点（starter/）

小念的生日是 **2024-08-01**（`starter/profile.json`）。`starter/` 里有 2024～2026 年的 22 个节点：

| 日子 | id | 节点 |
|---|---|---|
| 2024-08-01 | `hello` | 你好，小念（出生） |
| 2024-08-04 | `coming-home` | 从医院回家 |
| 2024-08-12 | `belly-button` | 脐带脱落（日子待确认） |
| 2024-09-01 | `full-month` | 满月啦 |
| 2024-11-08 | `hundred-days` | 满百天 |
| 2024-12-15 | `winter-cold` | 冬天生病了（日子待确认） |
| 2025-01-29 | `first-spring-festival` | 第一个春节 |
| 2025-03-10 | `first-tooth` | 长第一颗牙 |
| 2025-04-20 | `learn-to-crawl` | 会爬了 |
| 2025-06-20 | `first-word` | 第一次开口叫人 |
| 2025-08-01 | `first-birthday` | 一岁生日 |
| 2025-08-10 | `first-sea` | 第一次看海 |
| 2025-09-10 | `first-steps` | 迈出第一步 |
| 2025-10-06 | `mid-autumn-2025` | 中秋赏月 |
| 2026-02-17 | `spring-festival-2026` | 过年 |
| 2026-03-14 | `bubbles` | 吹泡泡 |
| 2026-04-05 | `spring-outing` | 春天去踏青 |
| 2026-05-01 | `zoo` | 去动物园 |
| 2026-06-18 | `puddle-jumping` | 雨天踩水坑 |
| 2026-08-01 | `second-birthday` | 两岁生日 |
| 2026-09-01 | `first-day-nursery` | 第一天上托班 |
| 2026-10-25 | `autumn-leaves` | 捡树叶 |

- 每个节点只有 `moment.json`（标题、一句话、日子、文字段）和 `notes.md`，没有照片、视频，没有 `said`
- 日子从哪来写在 `notes.md` 的标题里：大人确认的（出生、回家）、按生日算的（满月、百天、生日）、节日当天，其余是按常见月龄先填的「起步占位的日子」或「先估的，问大人」
- 出生、回家、脐带脱落、满月、冬天生病这几个的文字是大人说的（`notes.md` 里记着大人的原话）；其余是起步文字，等大人讲那天的事
- `npm run starter` 把 albums/ 里还没有的节点复制进去，已经有的不动；之后在 albums/ 里改
- **还没有照片的节点不加密、页面上不显示**（`seal` 会列在「没加密」里），加了照片才挂上绳子。用不上的整个文件夹删掉
- `starter/` 进 git、是**公开的明文**：大人决定把生日、节点的日子和大人的话放在这里，换机器 `npm run starter` 就有。照片、视频、小念的原话（`said`）不放这里，只放 albums/（测试会查）。大人确认了新的日子、新的话，albums/ 和 starter/ 里都改

## 做一个新图集：以「去动物园」为例

一个图集就是一天里的一件事，一般 3～8 张照片、最多一两段视频。

规划好的节点（`starter/` 里有的）不用新建，见「给成长节点加照片」。这里是新做一件规划里没有的事。

**1. 先对上。** `npm run status`。刚 `git pull` 过或者换了电脑，先 `npm run unseal`（见「换一台电脑」）。

**2. 原片放好。** 从手机导到电脑，放进 `private/zoo/`（或者直接用相册里的路径）。HEIC 照片先在手机上导出成 JPG。

**3. 建图集，收照片。** id 是这件事的英文小名，小写字母、数字、短横线：

```bash
npm run album:new -- zoo private/zoo/IMG_1201.jpg private/zoo/IMG_1203.jpg private/zoo/IMG_1210.jpg
```

建 `albums/zoo/`：照片转正、缩到长边 1600、去掉拍摄时间和地点，编号成 `01.jpg`、`02.jpg`……，每张在 `blocks` 后面接一段；还有 `moment.json` 和 `notes.md`。视频的拍摄日会自动填进 `when.date`，只有照片的先填今天，要问大人。

**4. 加一段视频（可以没有）。** 先看原片、截帧挑一段，再剪进来（详见 video skill）：

```bash
npm run video -- --info private/zoo/IMG_1220.MOV      # 多长、哪天拍的、有没有声音
npm run video -- --frames private/zoo/IMG_1220.MOV    # 截帧拼成一张图，放 private/frames/
npm run album:add -- zoo private/zoo/IMG_1220.MOV --from 0:12 --to 0:40 --poster 0:21
```

视频压成 720p、码率封顶 2 Mbps，一分钟十几 MB；一段最长 180 秒。不要声音加 `--mute`。剪辑参数只配一段视频，一次加一段。之后再加照片也用 `album:add`，编号接在后面。

**5. 写那天的事。** 问大人（能问小念就问小念），每次一句：哪天、在哪儿、在干什么、为什么想留下来、小念说了什么。记进 `albums/zoo/notes.md`（不显示在页面上，但加密进 vault，换电脑能找回来），再写 `albums/zoo/moment.json`：

```json
{
  "title": "去动物园",
  "about": "第一次见到长颈鹿，踮着脚说它比爸爸还高。",
  "when": { "date": "2025-05-01", "label": "劳动节" },
  "blocks": [
    { "photos": ["01.jpg"], "caption": "进门第一眼就看到长颈鹿" },
    { "text": "那天人特别多，他坐在爸爸肩膀上看了好久……" },
    { "said": "长颈鹿的脖子为什么这么长呀？" },
    { "photos": ["02.jpg", "03.jpg"], "caption": "喂了两片树叶" },
    { "video": "04.mp4", "caption": "追着孔雀跑" }
  ]
}
```

- `title` ≤12 字；`about` ≤80 字，一句话说那天的事，首页预览和详情开头都用它
- `when.date` 是发生的那天；`label` 那天是什么日子，≤8 字，可以不写
- `blocks` 是详情页从上往下的一段一段，每段只能是一种：
  - `photos`：1 张大的，或 2～3 张并排（同一个场景的放一起）；`caption` ≤60 字，可以不写
  - `video`：一段视频（`NN.mp4` + `NN.poster.jpg`），`caption` 同上
  - `text`：大人写的一段话，≤300 字
  - `said`：小念的原话，≤40 字，**一字不改；没有就不写这一段**
- `cover`：绳子上的缩略图用哪张，不写就用第一张照片
- 同一天画廊里有作品加 `"work": "<作品id>"`，漫画书里有故事加 `"story": "<故事id>"`
- 不写 `id`：文件夹名就是 id

**6. 检查、看效果、发布。**

```bash
npm run check -- zoo        # 字数、日子、格式、文件在不在、拍摄信息、视频编码和大小、多出来的文件
npm run dev                 # 或者 npm run seal 手动加密
npm run snapshot -- home 2025 zoo                # 截图放 snapshots/，自己看一遍
npm run snapshot -- home 2025 zoo --width 390    # 手机宽度
git add vault && git commit -m "去动物园" && git push
```

`git status` 里应该只有 `vault/` 的变化。推不推、什么时候推，问大人（推到 main 就发布了）。

**年份卡**：默认用那一年最后一个图集的封面；想指定就在 `albums/profile.json` 写 `"covers": { "2025": "zoo/01.jpg" }`。

## 给成长节点加照片

`npm run starter` 复制进来的节点已经有文件夹和 `moment.json`，**不要再 `album:new`**，直接加：

```bash
npm run album:add -- zoo D:\相册\动物园\IMG_1201.jpg D:\相册\动物园\IMG_1203.jpg
npm run album:add -- zoo D:\相册\动物园\IMG_1220.MOV --from 0:12 --to 0:40
```

第一张照片放在最前面当开头的大图，起步文字跟在它后面，其余的接在最后。然后：

1. 改 `title`、`about`、`when.date`（真的日子）、每段说明；把起步文字换成那天真实的事；有小念的原话加 `said`
2. 并排的照片合进一段（`"photos": ["02.jpg", "03.jpg"]`）
3. `notes.md` 里的占位说明改掉，记下那天的事
4. `npm run check -- zoo`，通过了就会被加密、挂上绳子

这台电脑上要是还留着以前带色块占位图的 albums/（`01.jpg` 上写着「占位照片 · 换成真的」）：删掉那些 `NN.jpg`、`NN.poster.jpg` 和 `NN.mp4`，`blocks` 里引用它们的段也删掉，再 `album:add`。

## 换一台电脑、几台电脑一起做

`albums/` 不进 git，新电脑 clone 下来是没有的。

**还没提交过 vault**（GitHub 上没有 `vault/`）：从成长节点开始，见「第一次：准备好」：

```bash
git clone https://github.com/handsondad/kid-growth-timeline.git
cd kid-growth-timeline
npm install
Copy-Item .env.example .env.local   # 填 TIMELINE_PASSWORD
npm run starter                     # 22 个节点复制进 albums/，再 album:add 加照片
```

**已经提交过 vault**：图集都在加密的 `vault/` 里，用同一个密码解出来：

```bash
git clone https://github.com/handsondad/kid-growth-timeline.git
cd kid-growth-timeline
npm install
Copy-Item .env.example .env.local   # 填同一个 TIMELINE_PASSWORD
npm run unseal          # 解回 albums/：照片、视频、moment.json、notes.md、profile.json，和加密前一个字节都不差
npm run starter         # 可选：还没做的规划节点也复制进来（已经有的不动）
npm run dev
```

之后在哪台电脑上做，都是**先 `git pull` + `npm run unseal`，再动手**。

- `albums/.sealed.json` 记着上次和哪一版 `vault/index.enc` 对上了（seal、unseal 写，别手改）。vault 被别的电脑更新过而这台还没 `unseal`，`npm run seal`（和 `npm run dev` 的自动加密）会拒绝，提示先 `unseal`，免得把别处做的图集删掉
- `unseal` 只解出这台电脑上没有的；两边都改过的同一个图集不动，列出来让大人选：用 vault 里的 `npm run unseal -- --force`，用这台电脑上的 `npm run seal -- --force`。代码助手不要自己挑
- 只在这台电脑上有的图集，`unseal` 会列出来，不删

## 命令

需要 Node.js 22+。测试和脚本直接用 Node 跑 `.ts` 文件。

| 命令 | 作用 |
|---|---|
| `npm run status` | 图集在哪、有几个，vault 在哪，密码设了没有 |
| `npm run starter` | 把 `starter/` 里规划好的成长节点复制进 `albums/`（已经有的不动） |
| `npm run album:new -- <id> [照片或原片…] [剪辑参数]` | 新建一个图集（建文件夹，照片、视频处理好接进 blocks） |
| `npm run album:add -- <id> <照片或原片…> [剪辑参数]` | 往图集里加照片、视频：照片转正、缩到长边 1600、去掉拍摄信息；视频剪好压成 720p，编号接在后面 |
| `npm run video -- --info <原片>` | 看原片：时长、尺寸、拍摄日、有没有声音和位置 |
| `npm run video -- --frames <原片或id/NN> [--every 2] [--from] [--to]` | 截帧拼成一张图，放 `private/frames/`，用来挑起止点 |
| `npm run check [-- <id>]` | 检查 profile.json、每个图集的内容、照片和视频 |
| `npm run seal [-- --init] [--force]` | 把 `albums/` 加密进 `vault/`；第一次加 `--init` 生成钥匙；`--force` 用本机的盖掉更新过的 vault |
| `npm run seal -- --new-password` / `--rotate` | 换密码（新密码放在环境变量 `TIMELINE_NEW_PASSWORD`）/ 密码泄露了，连主钥匙一起换、全部重新加密（图集要都在本机、都检查得过） |
| `npm run unseal [-- --force]` | 把 `vault/` 解回 `albums/` |
| `npm run dev` | 开发服务器，自动打开浏览器；`albums/` 改了会自动加密、自己刷新（`KGT_AUTOSEAL=0` 关掉） |
| `npm run snapshot [-- home 2025 <id>...] [--width 390]` | 用密码解锁后截成 PNG，放在 `snapshots/`；顺便真的解密、解码一下每段视频 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | 全部测试（不需要 albums/；装了 ffmpeg 会真剪一段测试视频） |
| `npm run build` / `npm run preview` | 构建到 `dist/`（页面 + 复制进去的 vault，没有明文），用 preview 打开 |

剪辑参数：`--from 0:12 --to 0:40 [--poster 0:21] [--mute]`，时间按原片算，只配一段视频。

改代码交付前要过：`npm run typecheck`、`npm test`、`npm run build`。做了图集还要 `npm run check`、`npm run seal`，`npm run snapshot` 自己看一遍图，手机宽度（`--width 390`）也看。

环境变量（也可以写进 `.env.local`，模板见 `.env.example`）：`TIMELINE_PASSWORD`（密码）、`ALBUMS_DIR`（默认 `albums/`；放在项目里又没被 git 忽略的，工具会拒绝）、`VAULT_DIR`（默认 `vault/`）、`FFMPEG_PATH` / `FFPROBE_PATH`、`BROWSER_PATH`、`KGT_AUTOSEAL=0`。

## albums/（明文，不进 git）

```
albums/
  profile.json         { "name": "小念", "birthday": "2024-08-01", "covers": { "2026": "zoo/01.jpg" } }
  .sealed.json         上次和哪一版 vault 对上了
  zoo/                 一个图集一个文件夹，文件夹名就是 id（小写字母、数字、短横线）
    moment.json        这个图集的数据（类型见 src/moment/types.ts，不写 id）
    notes.md           那天的事、小念的原话、剪辑记录；不进页面，但加密进 vault
    01.jpg 02.jpg      照片（album:add 处理好、编好号）
    03.mp4             视频 + 03.poster.jpg 封面
```

原片不放 `albums/`；`albums/` 里只放处理好的。**`albums/` 要另外备份**（家里的硬盘、网盘）：vault 是加密的拷贝，密码忘了就解不开。

## vault 和加密

```
vault/
  key.json        随机主钥匙，被「密码 → Argon2id」得到的钥匙包着
  index.enc       所有图集的数据（加密的 JSON：profile、years、moments，每个文件、notes.md 记成 blobs 里的名字）
  blobs/<32位hex>  每张照片、视频、缩略图、notes.md 各一个，按 1 MB 分块 AES-GCM 加密
```

- 先压缩、再加密（密文压不小）：照片长边 1600、JPEG 质量 0.82，一张三五百 KB；视频长边 1280、码率封顶 2 Mbps
- 密码经过 Argon2id（3 轮、64 MB 内存）变成一把钥匙，包着随机的主钥匙；主钥匙经 HKDF 分出加密用的钥匙和起文件名用的钥匙
- 每个文件按 1 MB 分块 AES-256-GCM 加密，被改过、截短、换了块的顺序都会发现
- 文件名是主钥匙算出来的 HMAC：同样的内容名字不变，没改的文件不重写，git 里不会无故变大；看不出是哪张照片
- 标题、日子、文字、缩略图都在加密的 index 和 blobs 里，没解锁之前什么都看不到；解密在浏览器里做（WebCrypto），密码不会发到任何地方
- 检查不过的图集不加密，`npm run seal` 会列出来
- 页面上「这台设备记住我」把解开的钥匙存在那台设备的浏览器里，换密码后要重新输；只在自己的手机、电脑上勾
- 代码：`src/vault/crypto.ts`（浏览器和 Node 共用）、`tools/seal.mjs`（加密）、`tools/unseal.mjs`（解回 albums/）、`src/library.ts`（页面解开）

## 地图

| 路由 | 页面 | 文件 |
|---|---|---|
| （没解锁） | 输密码 | `src/pages/LockPage.tsx` |
| `#/`、`#/year/<年>`、`#/at/<id>` | 首页时间绳：年份卡，点开一年左右滑（没有滚动条，位置在 `src/pages/timeline.ts`）；点一个，下面出预览，「看详情」 | `src/pages/WallPage.tsx` |
| `#/moment/<id>` | 详情：一篇图文，点照片看大图，视频点了才下载解密；← → 或左右滑动换一个，Esc 回首页 | `src/pages/MomentPage.tsx` |

代码和工具：

- `src/App.tsx`：读 `vault/key.json` → 输密码（或用记住的钥匙）→ 解开 `index.enc` → 路由
- `src/library.ts`：解锁、记住钥匙、下载解密 blob（照片有缓存，视频带进度）
- `src/pages/VaultMedia.tsx`：加密的照片（滚到跟前才解）、加密的视频（封面 → 点了下载解密 → 播放）
- `src/moment/types.ts`、`src/moment/vocab.ts`：图集、图文段落、vault 目录的类型，文件名规则
- `src/vault/crypto.ts`：钥匙、加密解密、文件名
- `tools/library.mjs`：找 albums/ 和 vault、读 `.env.local`、读图集、`npm run status`
- `tools/seal.mjs`：加密 albums/，缩略图（360×360，ffmpeg 做），删掉用不上的 blob，同步标记
- `tools/unseal.mjs`：把 vault 解回 albums/，不盖掉两边不一样的
- `tools/vite-library.mjs`：Vite 插件，开发时只给 `vault/` 下的三种文件（支持分段）、不给 albums/ 里的任何东西（包括 `/@fs/` 路径），并自动加密；构建时把 vault 复制进 `dist/`
- `tools/photo.mjs`：用本机浏览器的画布重画照片，顺便去掉 Exif；也给检查器读 JPEG/PNG
- `tools/video.mjs`：调 ffmpeg 看原片、截帧、剪辑、截封面；也给检查器读 MP4（纯 JS）
- `tools/add-media.mjs`（album:add）、`tools/new-moment.mjs`（album:new）、`tools/starter.mjs`（starter）、`tools/snapshot.mjs`
- `starter/`：规划好的成长节点（只有文字，进 git）
- `tests/moment-rules.mjs`：图集检查器；`tests/fixtures.mjs`：测试用的假图集
- `skills/`：给代码助手的做图集、剪视频说明
- `.github/workflows/ci.yml`：检查、构建，main 上发布到 GitHub Pages
- `public/fonts/timeline.woff2`：完整的站酷快乐体（OFL），不截子集

旧的 Nuxt + SQLite 版本（网页里导入、裁剪视频的后台队列）在提交 `f060b94` 及之前的历史里。

## 硬性规矩

- **明文不进 git**：真实的照片、视频、`moment.json`、`notes.md`、`profile.json` 只写进 `albums/`，进 git 的只有 `vault/` 和只有文字的 `starter/`（大人同意公开的生日、节点日子和大人的话；不放照片、视频和小念的原话，测试会查它只有 `moment.json`、`notes.md`，blocks 只有文字）。测试里用工具现场生成的假素材。`albums/`、`dist/`、`snapshots/`、`private/` 都已被忽略，不要改 `.gitignore` 把它们放出来，也不要 `git add -f`。
- **密码不进 git**：不写进代码、提交信息、PR、日志、截图和测试里（测试用固定的假密码）。只放 `.env.local` 或环境变量。不要替大人起密码。
- **加密别削弱**：不要调低 `src/vault/crypto.ts` 里 Argon2id 的强度、不要缩短密码下限、不要在 vault 外面放能看出内容的东西。改加密格式要能读旧的，或者让大人跑 `--rotate`。
- **别弄丢别处做的图集**：`seal` 报「vault 里的图集比 albums/ 新」时先 `unseal`；`--force` 只在大人选好用哪边之后加。
- **发布**：只发布 GitHub Pages（CI 里自动），发出去的是页面和 vault。开发和预览服务器只听 `127.0.0.1`，不要改成 `0.0.0.0`；别的地方要发布，先问大人。
- **先压缩再加密**：体积在 `album:add` 那一步就定了（`PHOTO` 在 `tools/photo.mjs`，`CLIP`、`encodeArgs` 在 `tools/video.mjs`）。推上去的旧版本会一直留在历史里，不要动不动就调参数重压所有图集。
- **只挑最好的一段**：一段视频不超过 180 秒、90 MB（GitHub 单个文件上限 100 MB）。原片不要整个搬进 albums/。整个 vault 不要超过 1 GB（Pages 的上限，`npm run seal` 快到了会提示）。
- **小念的原话**：`said` 一字不改；没问到就不写，不要替他编。大人的话写进 `about` 和 `text`。
- **日子**：`when.date` 写发生的那天。`album:new` 会把原片里读出来的拍摄日填进去，跟大人核对一下；不知道就问，别猜。生日写在 `albums/profile.json`，别猜。
- **素材许可**：站酷快乐体是 OFL，hash-wasm 是 MIT；新素材、新依赖要在 `THIRD_PARTY_NOTICES.md` 写明来源。
- **代码风格**：照周围代码写。中文注释只写代码本身表达不了的约束；改动要小而完整。

## 已知的坑

- **密码忘了就没了**：vault 解不开，只能拿本机的 `albums/` 重新 `--init`。`albums/` 要备份。
- **git 历史删不掉**：推上去的 vault 一直在历史里。换密码（`--new-password`）只是重新包钥匙，知道旧密码的人还能从旧的 `key.json` 拿到主钥匙；密码真泄露了用 `--rotate`（全部重新加密，仓库变大一倍）。图集删掉了，历史里的密文还在。
- **页面上写着「还没有加密好的图集」**：`vault/key.json` 不存在，跑 `npm run seal -- --init`。开发时没设密码不会自动加密，终端会提示。
- **`npm run dev` 终端里「没有自动加密：vault 里的图集比 albums/ 新」**：别的电脑推过，先 `npm run unseal`。
- **换密码、换 `ALBUMS_DIR` 要重启 `npm run dev`**。
- **`.ts` 扩展名**：Node 直接跑 `.ts`，所以被测试导入的文件相互导入时要写 `.ts` 扩展名。`tsconfig` 开了 `allowImportingTsExtensions`。
- **截图和处理照片要用本机 Edge/Chrome**：`puppeteer-core` 不自带浏览器；找不到时设 `BROWSER_PATH`。开源的 Chromium 解不了 H.264，截图会报「视频放不出来」。
- **ffmpeg**：要带 ffprobe 和 libx264，7.0 以上（测试里用到 `-display_rotation`）。没有 ffmpeg 时缩略图直接用原图，页面会慢一些。
- **dist/ 双击打不开**：浏览器不让 `file://` 读 vault，用 `npm run preview`。
- **视频要整段下载解密才能播**：所以有 90 MB 上限；手机流量下点开大视频要等一会儿（有进度）。
- **HEIC 照片**：浏览器解不开，先在手机上导出成 JPG。Live Photo 想要动的，就把那段 MOV 当视频收。
- **iPhone 的 HDR 视频**：剪出来颜色会发灰（`--info` 会提示），先在手机上导出成「兼容性最佳」再剪。
- **删掉、换掉一张照片**：把文件删了、`moment.json` 的 blocks 里也去掉，`npm run check` 会提示多出来或者找不到的文件；新的用 `album:add` 加（编号接在后面）。
- **整页截图里背景有一道硬边**：`background-attachment: fixed` 在长截图里的样子，真实浏览没有。
