---
name: kid-growth-curate
description: >-
  Guides adding one moment (a small photo-and-text story with photos and short
  videos) of Nian's growth to the local moment library used by the
  kid-growth-timeline app: confirm the library, run moment:new / moment:add,
  write notes.md and moment.json blocks, run check, seal the encrypted vault and
  snapshot. Plaintext media and data never go into git; only the encrypted
  vault/ does. Use when adding or revising a moment, photo, video, title, date,
  caption or notes, or when the user mentions 成长时光轴、时光库、新照片、新视频、
  收进时光轴、挂上绳子、图集、notes.md、moment.json、加密、seal、vault.
---

# 小念的成长时光轴：收一个新瞬间

目标：把小念长大路上值得记住的一天挂上绳子，做成一篇小小的图文。大人（和 agent）负责挑、剪、记下来。

明文的照片、视频和数据都放在**时光库**（仓库外面的一个文件夹）里，不进 git；`npm run seal` 把它加密进 `vault/`，只有 `vault/` 提交、发布。仓库结构、命令、规矩见根目录 `AGENTS.md`。**有视频的，剪辑那一步照 [../kid-growth-video/SKILL.md](../kid-growth-video/SKILL.md) 做。**

## 八步

每一步都要大人点头才往下走。和孩子聊时一次只问一个问题。

```
- [ ] 1. npm run library：确认时光库、密码设了
- [ ] 2. 看素材，挑几张 / 挑一段
- [ ] 3. npm run moment:new -- <id> <照片…>，再加用 npm run moment:add
- [ ] 4. 问大人那天的事（能问小念就问小念）→ notes.md
- [ ] 5. 写 moment.json → npm run check -- <id>
- [ ] 6. npm run seal
- [ ] 7. npm run snapshot -- home <年> <id>（再加 --width 390 看手机）
- [ ] 8. 给大人看；说好了 git add vault && git commit
```

### 1. 确认时光库

```bash
npm run library
```

会打印时光库的位置、里面有几个瞬间、vault 在哪、密码设了没有。说「还没指定」就问大人照片放哪儿，然后 `npm run library -- <路径>`。**不要把时光库指到仓库里没被忽略的地方**，工具会拒绝；想放仓库里只能放 `library/`。

没设密码就请大人自己在 `.env.local` 里加一行 `TIMELINE_PASSWORD=…`（至少 12 位）。**你不要替大人起密码，也不要把密码写进任何文件、提交信息或者回复里。** 第一次用还要 `npm run seal -- --init` 生成钥匙。

### 2. 看素材

原片、原图可以放 `private/`（已被忽略），也可以直接用大人给的路径。用读图工具看照片；视频先 `npm run video -- --frames` 截帧再看（见 video skill）。

一个瞬间是一天里的一件事，一般 3～8 张照片、最多一两段视频就够。拍糊的、重复的、不是那件事的，跟大人说一声去掉。手机的 HEIC 照片先导出成 JPG。

### 3. 建目录、加照片和视频

```bash
npm run moment:new -- first-bike private/IMG_1234.jpg private/IMG_1236.jpg
npm run moment:add -- first-bike private/IMG_1240.MOV --from 0:12 --to 0:40
npm run moment:add -- first-bike private/IMG_1251.jpg
```

id 按这件事起，小写英文和短横线：`first-bike`、`lost-tooth`、`first-day-school`。会在时光库里建 `first-bike/`，里面有 `moment.json`、`notes.md`，照片按顺序编号成 `01.jpg`、`02.jpg`（转正、长边 1600、去掉拍摄信息，一张三五百 KB），视频是 `03.mp4` + `03.poster.jpg`。每加一个，`moment.json` 的 `blocks` 后面就接一段。视频的拍摄日会自动填进 `when.date`。剪辑参数只配一段视频，一次加一段。

### 4. 记下那天的事

照片和视频本身不会说话。问大人（能问小念就问小念），每次一句，记进时光库里的 `<id>/notes.md`：

1. 这是哪天？那天是什么日子吗？（不知道就问，别猜）
2. 在哪儿？在干什么？
3. 为什么想把这一天留下来？（第一次？好笑？感动？）
4. 小念那时候说了什么？（原话记进「小念说」）

### 5. 写 moment.json

```json
{
  "title": "第一次骑车",
  "about": "在公园里摔了两次，第三次自己骑出去好远。",
  "when": { "date": "2026-05-01", "label": "劳动节" },
  "blocks": [
    { "photos": ["01.jpg"], "caption": "出发前，头盔是自己挑的" },
    { "text": "前两次一松手就倒。第三次爸爸没说就松了手，他骑出去二十多米才发现。" },
    { "video": "03.mp4", "caption": "第三次，自己骑出去了" },
    { "said": "爸爸你别松手！……你什么时候松的手？" },
    { "photos": ["02.jpg", "04.jpg"], "caption": "膝盖蹭破了，还要再骑一圈" }
  ]
}
```

- `title` ≤12 字；`about` ≤80 字，一句话说那天的事，首页预览和详情开头都用它
- `when.date` 是发生的那天；`label` ≤8 字，可以不写
- `blocks` 是详情页从上往下的一段一段，每段只能是一种：
  - `photos`：1 张大大的，或 2～3 张并排（同一个场景、前后脚拍的放一起）；`caption` ≤60 字，可以不写
  - `video`：一段视频；`caption` 同上
  - `text`：大人写的一段话，≤300 字，把 notes.md 里那天的事讲清楚，照片之间穿插着放
  - `said`：小念的原话，≤40 字，一字不改；没有就不写这一段
- 好看的顺序：先一张最能说明那天的照片，再一段话，再照片和视频，原话放在最打动人的那张后面
- `cover`：绳子上的缩略图用哪张（文件名），不写就用第一张照片
- 同一天画廊里有作品加 `"work": "<作品id>"`，漫画书里有故事加 `"story": "<故事id>"`
- 不写 `id`：目录名就是 id

用不上的照片：文件删掉，blocks 里也去掉。跑 `npm run check -- <id>`，检查器管：JSON 读不读得出来、字数、日子、每一段的格式、媒体文件在不在、有没有拍摄信息、视频编码和大小、多出来的文件。

**这一年的年份卡**：时光库根目录的 `library.json` 里 `covers` 可以指定一年用哪张照片（`"2026": "first-bike/01.jpg"`），不写就用那一年最后一个瞬间的封面。`birthday` 是生日，用来算「那天几岁」，不知道就问，别猜。

### 6. 加密

```bash
npm run seal
```

开着 `npm run dev` 的话会自动跑。输出里「没加密」的就是检查不过的，修好再跑。快到 1 GB 会提示（Pages 的上限）。

### 7. 截图

```bash
npm run snapshot -- home 2026 <id>
npm run snapshot -- home 2026 <id> --width 390
```

`2026` 是这个瞬间所在的年，截的是那一年展开的样子。打开 `snapshots/` 看：

- 首页年份卡的照片认得出、几岁对；展开那一年，新瞬间夹在对的日子上
- 详情页照片是正的，并排的几张是一组，文字和照片穿插得顺；视频封面挑的那一帧好看
- 手机宽度下字没有挤出框
- snapshot 没有报「视频放不出来」或者页面报错

看完把 `snapshots/` 丢掉（里面是家里的照片，已被忽略）。

### 8. 给大人看

把截图给大人看；或者告诉他 `npm run dev` 打开浏览器自己看。大人说好了：

```bash
git add vault
git commit -m "收进：第一次骑车"
```

推不推、什么时候推，问大人（推到 main 就发布到网上了）。

## 验收

- `npm run check` 无报错，`npm run seal` 没有「没加密」的
- `git status` 里只有 `vault/` 的变化，没有照片、视频、`moment.json`、`notes.md`、`.env.local`
- `said` 是小念的原话，或者没有
- 手机宽度下能看清、能左右滑、能换一个，视频能点开放
