import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { momentLibrary } from "./tools/vite-library.mjs";

export default defineConfig({
  base: "./",
  plugins: [react(), momentLibrary()],
  server: {
    host: "127.0.0.1",
    open: true,
    // 加密时一下子写很多文件，Windows 上盯着它们容易报 EBUSY；页面也用不着它们热更新
    watch: { ignored: ["**/vault/**", "**/private/**", "**/snapshots/**", "**/dist/**"] },
  },
  preview: { host: "127.0.0.1", open: true },
});
