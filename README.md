# 小念的成长时光轴

小念长大路上的一件件事，每件事做成一个**图集**：几张照片、一段小视频、大人写的话、小念的原话。图集按发生的日子夹在一根晾衣绳上；每一年收成一张年份卡，挂着一张照片和「那年几岁」，点开一年左右滑着看，点一个「看详情」就是那天的一篇图文。

和 [小念的画廊](https://github.com/handsondad/kids-gallery)、[小念家的漫画书](https://github.com/handsondad/storyverse) 是同一个系列：同一套颜色、字体和首页晾衣绳。

## 三样东西，分清楚就不会出错

| | 是什么 | 在哪 | 进 git 吗 |
|---|---|---|---|
| **原片** | 手机里拍的原图、原视频，又大又带拍摄地点 | 家里的相册，或者项目里的 `private/` | 不进 |
| **图集** | 挑过、压缩好的照片和视频，加上标题、日子、文字。一件事一个文件夹 | 项目里的 `albums/` | **不进**（明文） |
| **vault** | `albums/` 加密后的样子，看不出任何内容 | 项目里的 `vault/` | **进**，发布到网上的就是它 |

原片 → `npm run album:new` / `album:add`（挑、压缩、去掉拍摄信息）→ `albums/` → `npm run seal`（加密）→ `vault/` → `git push` → 网页上输密码在浏览器里解开。

仓库是公开的，`albums/`、`private/`、`.env.local` 都已被 `.gitignore` 忽略；推上去的只有加密的 `vault/`，安全全靠密码。

## 第一次：准备好（只做一次）

要装：Node.js 22+、ffmpeg 7+（带 ffprobe 和 libx264）、本机的 Edge 或 Chrome。

```bash
npm install
```

在项目根目录建一个 `.env.local` 文件（不进 git），写一行密码。至少 12 位，几个随机的词连起来最好记：

```
TIMELINE_PASSWORD=换成你自己的密码
```

**密码忘了就再也解不开了**，没有找回的办法。记在家里人都知道的地方。

```bash
npm run status          # 看图集有几个、vault 在哪、密码设了没有
npm run seal -- --init  # 生成钥匙，把 albums/ 加密进 vault/
npm run dev             # 浏览器打开，输密码看
```

项目里已经有一套**起步图集**（出生、百天、一岁生日、去动物园、第一次看海……2024～2026 年共 18 个），照片是写着「占位照片 · 换成真的」的色块，日子、文字也是先填的。照着下面「改一个起步图集」把它们换成真的；用不上的整个文件夹删掉就行。

> 生日先填的是 2024-01-01（`albums/profile.json` 的 `birthday`），用来算「那年几岁」。改成真的生日，`hello`（出生）这个图集的日子也一起改。

第一次发布前，到 GitHub 仓库 Settings → Pages → Source 选「GitHub Actions」（已经开好了）。

## 做一个新图集：以「去动物园」为例

一个图集就是一天里的一件事，一般 3～8 张照片、最多一两段视频。

**1. 把原片放好。** 从手机导到电脑，放进 `private/zoo/`（或者直接用相册里的路径）。iPhone 的 HEIC 照片先导出成 JPG。

**2. 建图集，把照片收进来。** id 是这件事的英文小名，小写字母、数字、短横线：

```bash
npm run album:new -- zoo private/zoo/IMG_1201.jpg private/zoo/IMG_1203.jpg private/zoo/IMG_1210.jpg
```

会建 `albums/zoo/`：照片转正、缩到长边 1600、去掉拍摄时间和地点，编号成 `01.jpg`、`02.jpg`……；还有 `moment.json`（图集的内容）和 `notes.md`（记录）。

**3. 加一段视频（可以没有）。** 先看看原片、截帧挑一段，再剪进来：

```bash
npm run video -- --info private/zoo/IMG_1220.MOV      # 多长、哪天拍的
npm run video -- --frames private/zoo/IMG_1220.MOV    # 截帧拼成一张图，放 private/frames/
npm run album:add -- zoo private/zoo/IMG_1220.MOV --from 0:12 --to 0:40 --poster 0:21
```

视频会压成 720p、码率封顶 2 Mbps，一分钟十几 MB；一段最长 180 秒。不要声音加 `--mute`。之后想再加照片也用 `album:add`，编号接在后面。

**4. 写那天的事。** 打开 `albums/zoo/moment.json`：

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

- `title` 标题，≤12 字；`about` 一句话说那天的事，≤80 字
- `when.date` 是发生的那天；`label` 那天是什么日子（生日、春节……），可以不写
- `blocks` 是详情页从上往下的一段一段，每段只能是一种：
  - `photos`：1 张大的，或 2～3 张并排；`caption` 一句说明，≤60 字，可以不写
  - `video`：一段视频，`caption` 同上
  - `text`：大人写的一段话，≤300 字
  - `said`：小念的原话，≤40 字，**一字不改；没有就不写这一段**
- `cover`：绳子上的小图用哪张，不写就用第一张照片

`notes.md` 随手记那天更多的事、小念说过的话、剪辑记录；它不显示在页面上，但会加密进 vault，换电脑能找回来。

**5. 检查、看效果。**

```bash
npm run check -- zoo    # 字数、日子、文件对不对，有问题会说怎么改
npm run dev             # 开着的时候 albums/ 一改就自动加密、页面自己刷新
```

**6. 发布。**

```bash
git add vault
git commit -m "去动物园"
git push                # 推到 main，几分钟后 https://handsondad.github.io/kid-growth-timeline/ 就有了
```

`git status` 里应该只有 `vault/` 的变化。

也可以把原片交给代码助手，说清楚是哪天、发生了什么，它会照 [skills/kid-growth-curate/SKILL.md](skills/kid-growth-curate/SKILL.md) 一步步做，有视频的照 [skills/kid-growth-video/SKILL.md](skills/kid-growth-video/SKILL.md) 剪。

## 改一个起步图集

以 `zoo` 为例，起步图集里的照片是 `01.jpg`～`04.jpg` 四张占位图：

1. 把占位照片删掉：`albums/zoo/` 里的 `01.jpg`～`04.jpg`，`moment.json` 的 `blocks` 里引用它们的几段也删掉
2. 收真的照片：`npm run album:add -- zoo private/zoo/IMG_1201.jpg private/zoo/IMG_1203.jpg`，编号接着排（`05.jpg`、`06.jpg`……），`blocks` 后面会多出几段
3. 改 `moment.json`：标题、`about`、`when.date`、每段的说明，删掉那段「照片和这段字都是起步占位的……」
4. `npm run check -- zoo`，通过了 `npm run dev` 看一眼

想让编号从 01 开始，就先把整个 `albums/zoo/` 删掉，再 `npm run album:new -- zoo <照片…>` 重新建。

年份卡默认用那一年最后一个图集的封面；想指定就在 `albums/profile.json` 里写 `"covers": { "2025": "zoo/05.jpg" }`。

## 换一台电脑接着做

`albums/` 不进 git，所以新电脑上 clone 下来是没有的；它就在加密的 `vault/` 里，用密码解出来：

```bash
git clone https://github.com/handsondad/kid-growth-timeline.git
cd kid-growth-timeline
npm install
# 建 .env.local，写同一个 TIMELINE_PASSWORD=…
npm run unseal          # 把 vault 解回 albums/：照片、视频、moment.json、notes.md、profile.json
npm run dev
```

之后在哪台电脑上做，都是**先 `git pull` + `npm run unseal`，再动手**。

- 别的电脑推了新图集，这台的 `albums/` 就旧了。这时 `npm run seal`（和 `npm run dev` 的自动加密）会停下来，提示先 `unseal`，免得把别处做的图集删掉
- `unseal` 只解出这台电脑上没有的；两边都改过的同一个图集不动，列出来让你选：用 vault 里的 `npm run unseal -- --force`，用这台电脑上的 `npm run seal -- --force`

## 要知道的几件事

- **密码忘了就解不开**。vault 就是唯一的拷贝时，等于全没了；`albums/` 最好再在家里的硬盘、网盘上另外备份一份
- **推上去的东西一直在 git 历史里**：删掉的图集，旧的密文还在历史里。密码泄露了用 `TIMELINE_NEW_PASSWORD=新密码 npm run seal -- --rotate`，连主钥匙一起换
- 网页上「这台设备记住我」只在自己的手机、电脑上勾
- 视频要整段下载解密完才能播，手机流量下点开大视频要等一会儿
- 整个 vault 不要超过 1 GB（GitHub Pages 的上限），`npm run seal` 快到了会提示

## 命令

| 命令 | 作用 |
|---|---|
| `npm run status` | 图集在哪、有几个，vault 在哪，密码设了没有 |
| `npm run album:new -- <id> [照片或原片…] [剪辑参数]` | 新建一个图集 |
| `npm run album:add -- <id> <照片或原片…> [剪辑参数]` | 往图集里加照片、视频（编号接在后面） |
| `npm run video -- --info <原片>` | 看原片：时长、尺寸、拍摄日、有没有声音和位置 |
| `npm run video -- --frames <原片或id/NN> [--every 2] [--from] [--to]` | 截帧拼成一张图，挑起止点用 |
| `npm run check [-- <id>]` | 检查图集 |
| `npm run seal [-- --init]` | 加密进 `vault/`；`--force` 用这台电脑上的盖掉 vault；`--new-password` 换密码；`--rotate` 连主钥匙一起换 |
| `npm run unseal [-- --force]` | 把 `vault/` 解回 `albums/` |
| `npm run dev` | 本机打开看，`albums/` 一改就自动加密 |
| `npm run snapshot [-- home 2025 <id>] [--width 390]` | 解锁后截成 PNG，放 `snapshots/` |
| `npm run typecheck` / `npm test` | 类型检查 / 测试 |
| `npm run build` / `npm run preview` | 构建到 `dist/`（页面 + 加密的 vault），用 preview 打开 |

剪辑参数：`--from 0:12 --to 0:40 [--poster 0:21] [--mute]`，只配一段视频。

## 加密是怎么做的

先压缩、再加密（加密后的数据压不小了）：照片长边 1600、JPEG 质量 0.82，一张三五百 KB；视频长边 1280、码率封顶 2 Mbps。

- 密码经过 Argon2id（3 轮、64 MB 内存）变成一把钥匙，包着一把随机的主钥匙，放在 `vault/key.json`
- 每个文件用主钥匙按 1 MB 分块 AES-256-GCM 加密，被改过、截短都会发现；文件名是主钥匙算出来的，看不出是哪张
- 标题、日子、文字、缩略图、notes.md 都在加密的 `vault/index.enc` 和 `vault/blobs/` 里，没解锁之前什么都看不到
- 解密在浏览器里做（WebCrypto），密码不会发到任何地方

## 目录

| 位置 | 内容 |
|---|---|
| `albums/` | 图集（明文，不进 git） |
| `vault/` | 加密后的图集（进 git、发布） |
| `private/` | 原片、截帧图（不进 git） |
| `src/` | 页面：输密码、首页时间绳、详情页、加密的照片和播放器；`src/vault/` 加密 |
| `tools/` | 图集、加密解密、Vite 插件、处理照片、剪视频、截图 |
| `tests/` | 测试和图集检查器 |
| `skills/` | 给代码助手的做图集、剪视频说明 |

旧的 Nuxt + SQLite 版本在提交 `f060b94` 及之前的历史里。

## 许可

代码 MIT，见 [LICENSE](LICENSE)。字体：站酷快乐体（OFL）；加密用到 hash-wasm（MIT），见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
