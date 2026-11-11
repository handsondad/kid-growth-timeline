---
name: kid-growth-video
description: >-
  Cuts a family video into a short clip for a moment in the kid-growth-timeline
  library in the background with tools/video.mjs and moment:add: probe the
  source, build a frame contact sheet to look at, pick the best range and
  poster frame, encode (H.264 720p, ≤2 Mbps, ≤180 s, metadata stripped) into
  the library and verify. Use when the user hands over a video, asks to
  剪视频、剪一段、截取、裁剪、换封面、去掉声音, or when a moment has a video block.
---

# 小念的成长时光轴：剪一段小视频

网页里没有剪辑功能：原片交给 agent，在后台剪好放进时光库。agent 看不了视频、也听不到声音，所以靠两样东西：`--info` 读出来的信息，和 `--frames` 截出来的一张帧拼图。

收瞬间的整体流程见 [../kid-growth-curate/SKILL.md](../kid-growth-curate/SKILL.md)，规矩见根目录 `AGENTS.md`。剪出来的东西都写进时光库（`npm run library` 看在哪儿），不进 git；`npm run seal` 加密后的 `vault/` 才进 git。

## 六步

```
- [ ] 1. npm run video -- --info <原片>
- [ ] 2. npm run video -- --frames <原片>，打开拼图看
- [ ] 3. 挑起止点、封面；定要不要 --mute
- [ ] 4. 剪：npm run moment:new（新瞬间）或 npm run moment:add（加进已有的瞬间）
- [ ] 5. 验：npm run video -- --frames <id>/<编号>，npm run check -- <id>，seal，snapshot
- [ ] 6. 给大人看：起止点、封面、声音，想改就重剪
```

### 1. 看原片信息

```bash
npm run video -- --info private/IMG_1234.MOV
```

会告诉你时长、尺寸（已经按旋转标记转正）、编码、有没有声音、拍摄日、有没有位置信息。

- **拍摄日**就是 `when.date` 的候选，`moment:new` 会自动填；跟大人核对一下
- **超过 180 秒**必须用 `--from` / `--to` 挑一段
- **HDR** 提示：剪出来颜色会发灰，请大人先在手机上导出成「兼容性最佳」再给你
- **有声音**：你听不到，见第 3 步

### 2. 截帧拼图

```bash
npm run video -- --frames private/IMG_1234.MOV              # 每 2 秒一格
npm run video -- --frames private/IMG_1234.MOV --every 0.5 --from 0:10 --to 0:20   # 放大看一小段
```

输出 `private/frames/<文件名>.jpg`（已被忽略），每行 6 格，从左到右、从上到下；命令会打印每一格对应的时间。用读图工具打开它。最多 48 格，原片太长会自动拉开间隔，想看细一点就加 `--from` / `--to` 只截一段。

### 3. 挑一段

看拼图时想清楚：

- **这一刻在哪儿**：动作开始前留一两秒，结束后留一两秒；先粗看全片，再对那一小段用 `--every 0.5` 细看定起止点
- **只留最好的一段**：10～60 秒最好看，上限 180 秒、90 MB。页面要把整段下载解密完才能播，手机上越短越快
- **封面**（`--poster`）：挑一格画面清楚、不糊、小念在画面里的；不写就用开头三分之一处（最多第 3 秒）
- **声音**：默认保留。大人说过「这段太吵」「声音不要」的，加 `--mute`；拿不准就问

时间写法：`12.5`、`0:12.5`、`1:02:03`，**都按原片算**（封面也是）。

### 4. 剪

新瞬间：

```bash
npm run moment:new -- first-bike private/IMG_1234.MOV --from 0:12 --to 0:40 --poster 0:21
```

加进已有的瞬间（编号接在最后，`blocks` 后面多一段 `{ "video": "03.mp4" }`，挪到合适的位置、写 `caption`）：

```bash
npm run moment:add -- first-bike private/IMG_1234.MOV --from 0:12 --to 0:40 --poster 0:21 --mute
```

剪辑参数只配一段视频，一次加一段。**重剪、换封面、去声音**：把旧的 `NN.mp4` 和 `NN.poster.jpg` 删掉，`moment:add` 重新剪一段，再把 `blocks` 里的文件名改成新的编号。

工具做的事：从原片里切出这一段（重新编码，起止点精确到帧）、按旋转标记转正、长边缩到 1280（720p）、最多 30 帧、H.264 + AAC、码率封顶 2 Mbps（一分钟十几 MB）、去掉拍摄时间、GPS、机型、索引放到文件头，再从成片里截封面。先在临时目录里做完、自己验一遍（编码、大小、拍摄信息、时长），不合格就不放进去。原片不动。

剪完会往时光库里 `<id>/notes.md` 的「剪辑」下面追加一行：文件名、原片文件名、剪的区间、封面、有没有去声音。原片换了位置也能照着这行重剪。

### 5. 验

```bash
npm run video -- --frames first-bike/03 --every 1   # 写 瞬间id/编号 就是看时光库里的成片
npm run check -- first-bike
npm run seal
npm run snapshot -- first-bike
```

- 成片拼图第一格和最后一格是你想要的开头和结尾
- `check` 通过；`snapshot` 会点开每段视频真的解密、解码，没有报「视频放不出来」
- 截图里封面好看、方向是正的

### 6. 给大人看

把起止点、封面那一格、有没有去声音，连同 snapshot 截图一起告诉大人；或者让他 `npm run dev` 直接点开放。想改就回第 4 步。

## 常见情况

| 情况 | 怎么办 |
|---|---|
| 一段原片里有两件值得留的事 | 同一天的，剪成两段放进同一个瞬间；不是同一天的，分成两个瞬间 |
| 想要两段拼在一起 | 现在不支持，剪成两段前后放；真的需要再给 `tools/video.mjs` 加功能，并补测试 |
| 竖着拍的 | 不用管，工具会转正；页面上竖着放 |
| Live Photo | 把那段 MOV 当视频收 |
| 剪出来超过 90 MB | 剪短一点（GitHub 单个文件上限 100 MB） |
| 找不到 ffmpeg | 装带 ffprobe 和 libx264 的 ffmpeg 7+，或设 `FFMPEG_PATH`、`FFPROBE_PATH` |
| 说「还没指定时光库」 | 问大人放哪儿，`npm run library -- <路径>` |
