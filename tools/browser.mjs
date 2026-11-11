// 找本机的 Edge 或 Chrome：puppeteer-core 不自带浏览器。找不到时设环境变量 BROWSER_PATH
import { existsSync } from "node:fs";

const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

export function findBrowser() {
  const path = BROWSERS.find((p) => existsSync(p));
  if (!path) throw new Error("找不到 Edge 或 Chrome，可以用环境变量 BROWSER_PATH 指定");
  return path;
}
