# 小念的成长时光轴

小念长大路上的照片和小视频，按发生的日子夹在一根晾衣绳上。每一年收成一张年份卡，挂着一张照片和「那年几岁」；点开一年，那一年的瞬间在绳子上左右滑着看。点一个「看详情」，是那天的一篇图文：几张照片、一段小视频、大人写的话、小念的原话。

**照片和视频是加密的。** 明文的照片、视频和说明放在你自己电脑上的一个文件夹里（叫「时光库」），不提交；`npm run seal` 把它们加密成仓库里的 `vault/`，只有它提交到 GitHub、发布到 GitHub Pages。打开网页输入密码，才在浏览器里解开。手机、平板打开网址输密码就能看。

剪视频不在网页里做：原片交给代码助手，它在后台用 `npm run video` 看信息、截帧、挑一段，剪好压好放进时光库，网页只负责播放。

和 [小念的画廊](https://github.com/handsondad/kids-gallery)、[小念家的漫画书](https://github.com/handsondad/storyverse) 是同一个系列：同一套颜色、字体和首页晾衣绳。

## 先看看效果

需要 Node.js 22+ 和 ffmpeg。

```bash
npm install
npm run demo        # 生成演示时光库 demo/（不进 git），加密，打开网站；密码打印在终端里
```

## 用起来

```bash
npm run library -- D:/小念/时光轴    # 指定时光库，记在 .env.local 里（不进 git）
```

在 `.env.local` 里加一行密码（至少 12 位，几个随机的词连起来最好记；不进 git）：

```
TIMELINE_PASSWORD=换成你自己的密码
```

```bash
npm run seal -- --init   # 第一次：生成钥匙，把时光库加密进 vault/
npm run dev              # 本机打开看；开着的时候时光库一改就自动加密、页面刷新
git add vault && git commit -m "新瞬间" && git push   # 发布
```

第一次发布前，到仓库 Settings → Pages → Source 选「GitHub Actions」。之后每次推到 main，CI 都会发布到 https://handsondad.github.io/kid-growth-timeline/ 。

几件要知道的事：

- **密码忘了就解不开**，没有找回的办法。时光库（明文）要自己另外备份
- 仓库是公开的，密文谁都能下载，安全全靠密码：别用短的、常用的
- 推上去的东西一直在 git 历史里。密码泄露了用 `TIMELINE_NEW_PASSWORD=新密码 npm run seal -- --rotate` 连主钥匙一起换
- 网页上「这台设备记住我」只在自己的手机、电脑上勾

| 路由 | 看什么 |
|---|---|
| `#/` | 时间绳：每年一张年份卡；点开一年，那一年的瞬间左右滑着看（没有滚动条），点小旗收起；点一个，下面出预览 |
| `#/moment/<id>` | 详情：那天的一篇图文，点照片看大图，视频点了才下载解密；← → 或左右滑动换一个，Esc 回首页 |

## 时光库

```
D:/小念/时光轴/
  library.json       名字、生日（算「几岁」）、每年的年份卡用哪张照片
  first-bike/
    moment.json      标题、日子、那天的事，一段一段的图文（照片、视频、文字、小念的原话）
    notes.md         更多记录、剪辑记录（不进页面，也不加密进 vault）
    01.jpg 02.jpg    照片
    03.mp4           视频 + 03.poster.jpg 封面
  lost-tooth/
    ...
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run library [-- <路径>]` | 看 / 换时光库 |
| `npm run dev` | 本机打开看（自动加密） |
| `npm run demo [-- --fresh]` | 用演示时光库打开看（要 ffmpeg） |
| `npm run seal [-- --init]` | 加密进 `vault/`；`--new-password` 换密码，`--rotate` 连主钥匙一起换 |
| `npm run moment:new -- <id> [照片或原片…]` | 新收一个瞬间 |
| `npm run moment:add -- <id> <照片或原片…>` | 往瞬间里加照片、视频（转正、缩小、去掉拍摄信息；视频剪好压好） |
| `npm run video -- --info <原片>` | 看原片的时长、尺寸、拍摄日 |
| `npm run video -- --frames <原片>` | 截帧拼成一张图，挑起止点用 |
| `npm run check` | 检查时光库里的内容、照片和视频 |
| `npm run snapshot` | 截成 PNG（加 `--width 390` 看手机） |
| `npm run typecheck` / `npm test` | 类型检查 / 测试 |
| `npm run build` / `npm run preview` | 构建到 `dist/`（页面 + 加密的 vault），用 preview 打开 |

收新瞬间时还要：

- 本机的 Edge 或 Chrome（处理照片、截图）
- ffmpeg 7+，带 ffprobe 和 libx264（剪视频、做缩略图）

## 收一个新瞬间

见 [AGENTS.md](AGENTS.md)、[skills/kid-growth-curate/SKILL.md](skills/kid-growth-curate/SKILL.md) 和剪视频的 [skills/kid-growth-video/SKILL.md](skills/kid-growth-video/SKILL.md)。一般是把照片或原片交给代码助手，说清楚是哪天、发生了什么。

## 加密是怎么做的

先压缩、再加密（加密后的数据压不小了）：`moment:add` 收进时光库时，照片缩到长边 1600（一张三五百 KB），视频压成 720p、码率封顶 2 Mbps（一分钟十几 MB）；`npm run seal` 加密的是压好的这份，加密本身几乎不增加体积。

- 密码经过 Argon2id（3 轮、64 MB 内存）变成一把钥匙，包着一把随机的主钥匙，放在 `vault/key.json`
- 每张照片、每段视频用主钥匙按 1 MB 分块 AES-256-GCM 加密，改过、截短都解得出来；文件名是主钥匙算出来的，看不出是哪张
- 标题、日子、文字、缩略图都在加密的 `vault/index.enc` 里，网页上没解锁之前什么都看不到
- 解密在浏览器里做（WebCrypto），密码不会发到任何地方

## 目录

| 位置 | 内容 |
|---|---|
| `src/` | 页面：输密码、首页时间绳、详情页、加密的照片和播放器；`src/vault/` 加密 |
| `tools/` | 时光库、加密、Vite 插件、新建瞬间、处理照片、剪视频、截图、演示 |
| `tests/` | 测试和内容检查器 |
| `skills/` | 给代码助手的收瞬间、剪视频说明 |
| `vault/` | 加密后的时光库（`npm run seal` 生成） |
| `public/fonts/` | 站酷快乐体 |

旧的 Nuxt + SQLite 版本（本机服务、网页里导入和裁剪视频）在提交 `f060b94` 及之前的历史里。

## 许可

代码 MIT，见 [LICENSE](LICENSE)。字体：站酷快乐体（OFL）；加密用到 hash-wasm（MIT），见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
