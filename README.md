# 小念的成长时光轴

小念长大路上的一件件事，每件事做成一个图集：几张照片、一段小视频、大人写的话、小念的原话。

图集按发生的日子夹在一根晾衣绳上。每一年收成一张年份卡，挂着一张照片和「那年几岁」；点开一年，那一年的图集在绳子上左右滑着看；点一个「看详情」，就是那天的一篇图文。

👉 https://handsondad.github.io/kid-growth-timeline/ （打开要输密码）

## 照片是加密的

仓库是公开的，但照片、视频和文字都只以加密的形式放在 `vault/` 里：文件名看不出是哪张，标题、日子也都在密文里。打开网页输入密码，在浏览器里解开，密码不会发到任何地方。明文的图集只在家里的电脑上，不提交。

## 同一个系列

和 [小念的画廊](https://github.com/handsondad/kids-gallery)、[小念家的漫画书](https://github.com/handsondad/storyverse) 是同一个系列：同一个小念，同一套颜色、字体和首页晾衣绳。同一天在画廊里有作品、在漫画书里有故事的，详情页会链过去。

## 怎么做内容、怎么开发

见 [AGENTS.md](AGENTS.md)：第一次怎么准备、规划好的成长节点（`starter/`）、怎么给节点加照片、换一台电脑接着做、命令、加密细节和规矩。

React 18 + TypeScript + Vite 5；加密用 Argon2id + AES-256-GCM。

## 许可

代码 MIT，见 [LICENSE](LICENSE)。字体：站酷快乐体（OFL）；加密用到 hash-wasm（MIT），见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。照片和视频不随代码许可授权。
