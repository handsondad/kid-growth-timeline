# 升级指南

## 更新本地代码

先停止开发服务器，并备份 `data/` 目录：

```bash
git pull
pnpm install
pnpm build
```

数据库迁移会在应用启动时自动执行。之后运行 `pnpm dev`，并打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。
