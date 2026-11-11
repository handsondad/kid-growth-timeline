---
name: kid-growth-curate
description: >-
  Guides making or revising one album (图集: one event in Nian's life, a small
  photo-and-text story with photos and short videos) in the kid-growth-timeline
  app: check status, unseal if needed, run album:new / album:add, write
  notes.md and moment.json blocks, run check, seal the encrypted vault and
  snapshot. Plaintext albums/ never go into git; only the encrypted vault/
  does. Use when adding or revising an album, replacing placeholder photos,
  fixing a title, date, caption or notes, or when the user mentions 成长时光轴、
  图集、成长节点、starter、新照片、新视频、挂上绳子、占位照片、notes.md、moment.json、加密、seal、
  unseal、vault.
---

# 小念的成长时光轴：做一个图集

目标：把小念长大路上值得记住的一件事挂上绳子，做成一篇小小的图文。大人（和 agent）负责挑、剪、记下来。

一件事一个图集，放在项目的 `albums/<id>/`（明文，不进 git）；`npm run seal` 把它加密进 `vault/`，只有 `vault/` 提交、发布。怎么做图集、命令、规矩都在根目录 `AGENTS.md`。**有视频的，剪辑那一步照 [../kid-growth-video/SKILL.md](../kid-growth-video/SKILL.md) 做。**

## 八步

每一步都要大人点头才往下走。和孩子聊时一次只问一个问题。

```
- [ ] 1. npm run status：图集在、密码设了；别的电脑做过的先 git pull + npm run unseal
- [ ] 2. 看素材，挑几张 / 挑一段
- [ ] 3. npm run album:new -- <id> <照片…>，再加用 npm run album:add
- [ ] 4. 问大人那天的事（能问小念就问小念）→ notes.md
- [ ] 5. 写 moment.json → npm run check -- <id>
- [ ] 6. npm run seal
- [ ] 7. npm run snapshot -- home <年> <id>（再加 --width 390 看手机）
- [ ] 8. 给大人看；说好了 git add vault && git commit
```

### 1. 先对上

```bash
npm run status
```

会打印 `albums/` 在哪、有几个图集、vault 在哪、密码设了没有。

- 说「还没有图集文件夹」又有 vault：换了电脑，先 `npm run unseal`
- 说密码「还没设」：请大人自己在 `.env.local` 里加一行 `TIMELINE_PASSWORD=…`（至少 12 位）。**你不要替大人起密码，也不要把密码写进任何文件、提交信息或者回复里**
- 还没有 vault：第一次用，`npm run seal -- --init`
- 刚 `git pull` 过：`npm run unseal`，把别的电脑做的图集解出来。`seal` 报「vault 里的图集比 albums/ 新」也是这个意思；`unseal` 列出「两边不一样」的，问大人用哪边（`unseal -- --force` 用 vault 的，`seal -- --force` 用这台电脑的），别自己挑

### 2. 看素材

原片、原图放 `private/`（已被忽略），或者直接用大人给的路径。用读图工具看照片；视频先 `npm run video -- --frames` 截帧再看（见 video skill）。

一个图集是一天里的一件事，一般 3～8 张照片、最多一两段视频。拍糊的、重复的、不是那件事的，跟大人说一声去掉。HEIC 照片先请大人导出成 JPG。

### 3. 建图集、加照片和视频

```bash
npm run album:new -- zoo private/zoo/IMG_1201.jpg private/zoo/IMG_1203.jpg
npm run album:add -- zoo private/zoo/IMG_1220.MOV --from 0:12 --to 0:40
npm run album:add -- zoo private/zoo/IMG_1251.jpg
```

id 按这件事起，小写英文、数字和短横线：`zoo`、`first-bike`、`lost-tooth`、`birthday-3`。会建 `albums/zoo/`，里面有 `moment.json`、`notes.md`；照片按顺序编号成 `01.jpg`、`02.jpg`（转正、长边 1600、去掉拍摄信息，一张三五百 KB），视频是 `03.mp4` + `03.poster.jpg`。每加一个，`blocks` 后面接一段。视频的拍摄日会自动填进 `when.date`；只有照片的先填今天，要问大人。剪辑参数只配一段视频，一次加一段。

**规划好的成长节点**（`starter/` 里有的，`npm run starter` 复制进 albums/ 的）：已经有文件夹，不要 `album:new`，见下面「给成长节点加照片」。

### 4. 记下那天的事

照片和视频本身不会说话。问大人（能问小念就问小念），每次一句，记进 `albums/<id>/notes.md`：

1. 这是哪天？那天是什么日子吗？（不知道就问，别猜）
2. 在哪儿？在干什么？
3. 为什么想把这一天留下来？（第一次？好笑？感动？）
4. 小念那时候说了什么？（原话记进「小念说」）

`notes.md` 不显示在页面上，但会加密进 vault，换电脑 `unseal` 能找回来。

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
- 不写 `id`：文件夹名就是 id

跑 `npm run check -- <id>`，检查器管：JSON 读不读得出来、字数、日子、每一段的格式、媒体文件在不在、有没有拍摄信息、视频编码和大小、多出来的文件。

**年份卡和生日**：`albums/profile.json` 里 `birthday` 用来算「那天几岁」，不知道就问，别猜；`covers` 可以指定一年用哪张照片（`"2026": "first-bike/01.jpg"`），不写就用那一年最后一个图集的封面。

### 给成长节点加照片

`starter/` 里规划好的节点（`hello`、`coming-home`、`full-month`、`zoo`……，清单见 `AGENTS.md`）只有标题、一句话、日子和文字段，没有照片；日子从哪来写在 `notes.md` 的标题里（大人确认的、按生日算的、先估的）。albums/ 里没有就先 `npm run starter`。

1. `npm run album:add -- <id> <真照片或原片…>`：第一张放在最前面当开头大图，起步文字跟在后面
2. 问大人真的日子和那天的事，改 `title`、`about`、`when`、每段说明，把起步文字换成真实的事，`notes.md` 里的占位说明也改掉
3. 大人说这件事没有发生过、或者不想要，整个文件夹删掉
4. 还没照片的节点检查不过、不加密、页面上不显示，这是正常的

`starter/` 是公开的明文、进 git：大人同意在这里放生日、节点日子和大人的话。大人确认了新的日子、新的节点、新的话，albums/ 和 starter/ 都改；**照片、视频、小念的原话（`said`）只放 albums/**，不写进 starter/。

以前留下的带色块占位图的图集（照片上写着「占位照片 · 换成真的」）：删掉那些 `NN.jpg`、`NN.mp4`、`NN.poster.jpg` 和 `blocks` 里引用它们的段，再 `album:add`。

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

`2026` 是这个图集所在的年，截的是那一年展开的样子。打开 `snapshots/` 看：

- 首页年份卡的照片认得出、几岁对；展开那一年，新图集夹在对的日子上
- 详情页照片是正的，并排的几张是一组，文字和照片穿插得顺；视频封面挑的那一帧好看
- 手机宽度下字没有挤出框
- snapshot 没有报「视频放不出来」或者页面报错

看完把 `snapshots/` 丢掉（里面是家里的照片，已被忽略）。

### 8. 给大人看

把截图给大人看；或者告诉他 `npm run dev` 打开浏览器自己看。大人说好了：

```bash
git add vault
git commit -m "去动物园"
```

推不推、什么时候推，问大人（推到 main 就发布到网上了）。

## 验收

- `npm run check` 无报错，`npm run seal` 没有「没加密」的
- `git status` 里只有 `vault/` 的变化，没有 `albums/`、照片、视频、`.env.local`
- `said` 是小念的原话，或者没有
- 手机宽度下能看清、能左右滑、能换一个，视频能点开放
