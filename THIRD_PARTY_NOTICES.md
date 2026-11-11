# 第三方素材

## 站酷快乐体（ZCOOL KuaiLe）

- 来源：https://github.com/google/fonts/tree/main/ofl/zcoolkuaile
- 许可：SIL Open Font License 1.1（`public/fonts/OFL.txt`，和字体放在一起）
- 使用：完整字库转成 WOFF2，放在 `public/fonts/timeline.woff2`，没有改动字形

## hash-wasm

- 来源：https://github.com/Daninet/hash-wasm
- 许可：MIT（Copyright (c) 2020 Dani Biró）
- 使用：页面和 `npm run seal`、`npm run unseal` 用它的 Argon2id 从密码算出钥匙，随页面一起打包发布

## FFmpeg

`npm run video`、`npm run album:add` 和 `npm run seal` 在本机调用 [FFmpeg](https://ffmpeg.org/)（LGPL/GPL，取决于构建方式）剪辑、压缩视频和做缩略图。FFmpeg 不随仓库分发。

## 照片和视频

照片和视频由家里人拍摄，加密后放在 `vault/`，不随代码许可授权。起步图集里的占位照片、视频是用 FFmpeg 现场画的色块，和真的照片一样只以加密的形式进 `vault/`。
