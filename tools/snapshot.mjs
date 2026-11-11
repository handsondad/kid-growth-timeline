// 把页面截成 PNG，放在 snapshots/ 下，给能看图的 agent 自查用。
//
//   npm run snapshot                          首页 + 每一年 + 每一个瞬间
//   npm run snapshot -- home 2025 first-bike  只截首页、2025 年展开的样子和这一个瞬间
//   npm run snapshot -- --width 390           手机宽度（默认 1000）
//
// 会自己起一个 Vite 开发服务器（不自动加密，截的是 vault 里现有的），用 TIMELINE_PASSWORD 解锁；
// 已经开着的话可以加 --url http://127.0.0.1:5173/ 直接用。
// 视频截的是封面；截完会点开每一段，真的解密、解码一下，放不出来就报错。
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { findBrowser } from "./browser.mjs";
import { password, readLibrary, root } from "./library.mjs";

const outDir = join(root, "snapshots");
const YEAR = /^\d{4}$/;

function parseArgs(argv) {
  const opts = { width: 1000, url: null, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--width") opts.width = Number(argv[++i]);
    else if (argv[i] === "--url") opts.url = argv[++i];
    else opts.targets.push(argv[i]);
  }
  return opts;
}

const hashOf = (t) => (t === "home" ? "#/" : YEAR.test(t) ? `#/year/${t}` : `#/moment/${t}`);
const fileOf = (t) => (YEAR.test(t) ? `year-${t}` : t);

/** 等看得见的加密照片都解开（绳子上滚出去的是懒加载的，不等），最多 10 秒 */
async function waitImages(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = (img) => {
      const r = img.getBoundingClientRect();
      if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return false;
      const box = img.closest(".line-scroll")?.getBoundingClientRect();
      return !box || (r.right > box.left && r.left < box.right);
    };
    const until = Date.now() + 10000;
    while (Date.now() < until) {
      const waiting = [...document.querySelectorAll("img.img-wait")].filter(visible);
      const decoding = [...document.images].filter((img) => !img.complete);
      if (!waiting.length && !decoding.length) return;
      await new Promise((ok) => setTimeout(ok, 150));
    }
  });
}

/** 点开页面上每一段视频，等它解密、解出第一帧 */
async function playVideos(page) {
  return page.evaluate(async () => {
    const bad = [];
    for (const button of document.querySelectorAll("button.video-start")) {
      const label = button.getAttribute("aria-label") ?? "视频";
      const frame = button.parentElement;
      button.click();
      const ok = await new Promise((done) => {
        const until = Date.now() + 30000;
        const poll = () => {
          const v = frame?.querySelector("video");
          if (v && v.readyState >= 2 && v.videoWidth > 0) return done(true);
          if (v?.error || frame?.querySelector(".video-note")?.textContent?.includes("再试") || Date.now() > until) return done(false);
          setTimeout(poll, 200);
        };
        poll();
      });
      frame?.querySelector("video")?.pause();
      if (!ok) bad.push(label);
    }
    return bad;
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { moments, dir } = readLibrary();
  const years = [...new Set(moments.map((m) => m.when.date.slice(0, 4)))].sort();
  const targets = opts.targets.length ? opts.targets : ["home", ...years, ...moments.map((m) => m.id)];
  for (const t of targets) {
    if (t !== "home" && !YEAR.test(t) && !moments.some((m) => m.id === t)) throw new Error(`没有瞬间 ${t}，看看 ${dir ?? "时光库"} 下的目录名`);
  }
  const pw = password();
  if (!pw) throw new Error("没有密码：在 .env.local 里写 TIMELINE_PASSWORD=…");

  let server = null;
  let base = opts.url;
  if (!base) {
    process.env.KGT_AUTOSEAL = "0";
    const { createServer } = await import("vite");
    server = await createServer({ root, logLevel: "error", server: { port: 0, open: false } });
    await server.listen();
    base = server.resolvedUrls.local[0];
  }

  mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width, height: 800, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const problems = [];
    page.on("pageerror", (err) => problems.push(err.message));
    page.on("console", (msg) => { if (msg.type() === "error") problems.push(msg.text()); });
    page.on("requestfailed", (req) => {
      // 换页时浏览器会掐掉还没下完的请求，不算错
      if (req.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`没加载出来：${req.url()}`);
    });
    page.on("response", (res) => { if (res.status() >= 400) problems.push(`${res.status()}：${res.url()}`); });

    await page.goto(base, { waitUntil: "networkidle0" });
    await page.waitForSelector(".lock-input, .hero", { timeout: 15000 });
    if (await page.$(".lock-input")) {
      await page.type(".lock-input", pw);
      await page.click(".lock-card .btn");
      await page.waitForSelector(".hero, .lock-error", { timeout: 30000 });
      if (await page.$(".lock-error")) throw new Error("密码不对：TIMELINE_PASSWORD 和 vault 对不上");
    }

    for (const t of targets) {
      await page.evaluate((hash) => { location.hash = hash; }, hashOf(t));
      await page.waitForSelector(t === "home" || YEAR.test(t) ? ".hero" : ".topbar", { timeout: 10000 });
      // 一屏一屏往下滚，让下面懒加载的照片也解开，再回到顶上整页截
      for (let y = 0; ; y += 700) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await waitImages(page);
        if (y + 800 >= (await page.evaluate(() => document.documentElement.scrollHeight))) break;
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const file = `${fileOf(t)}${opts.width === 1000 ? "" : `-${opts.width}`}.png`;
      await page.screenshot({ path: join(outDir, file), fullPage: true });
      console.log(`snapshots/${file}`);
      for (const label of await playVideos(page)) problems.push(`视频放不出来（${t}）：${label}`);
    }
    if (problems.length) {
      console.error("页面报错：\n" + [...new Set(problems)].join("\n"));
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
