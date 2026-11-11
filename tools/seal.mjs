// 加密图集：明文的 albums/ → 加密的 vault/。只有 vault/ 进 git、发布到网上，页面输入密码在浏览器里解开；
// notes.md 也加密进去（页面不显示），换台电脑 npm run unseal 能原样解回 albums/。
//
//   npm run seal                     加密：只加新的、改过的；albums/ 里删掉的，vault 里也删掉
//   npm run seal -- --init           第一次：生成钥匙 vault/key.json（密码至少 12 位）
//   npm run seal -- --new-password   换密码：新密码放在环境变量 TIMELINE_NEW_PASSWORD 里（主钥匙不变）
//   npm run seal -- --rotate         密码泄露了：连主钥匙一起换，所有文件重新加密
//   npm run seal -- --force          vault 比 albums/ 新时也照样用 albums/ 盖掉（一般先 npm run unseal）
//
// 密码放在 .env.local 的 TIMELINE_PASSWORD=（不进 git）。npm run dev 开着时会自己跑这个。
// 检查不过的图集不加密，列出来；缩略图用 ffmpeg 做，没有 ffmpeg 就直接用原图。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { blobName, CHUNK, createKeyFile, openBytes, openVault, rewrapKeyFile, sealBytes, unwrapMaster } from "../src/vault/crypto.ts";
import { coverFile, mediaFiles } from "../src/moment/vocab.ts";
import { checkMoment, checkProfile } from "../tests/moment-rules.mjs";
import { libraryDir, password, readLibrary, vaultDir } from "./library.mjs";
import { inspectPhoto } from "./photo.mjs";
import { inspectVideo, run } from "./video.mjs";

export const MIN_PASSWORD = 12;
/** albums/ 里记着上次和 vault 的哪一版对上了（seal、unseal 写）；不进 git */
export const SYNC_FILE = ".sealed.json";
const BLOB = /^[0-9a-f]{32}$/;
const THUMB = 360;
const TYPES = { ".jpg": "image/jpeg", ".mp4": "video/mp4" };
/** GitHub Pages 整站 1 GB */
const PAGES_LIMIT = 1024 ** 3;

/** 解开（或者第一次生成）主钥匙 */
export async function openKey(vault, pw, { init = false } = {}) {
  const file = join(vault, "key.json");
  if (existsSync(file)) return unwrapMaster(JSON.parse(readFileSync(file, "utf8")), pw);
  if (!init) throw new Error(`还没有钥匙 ${file}：第一次先 npm run seal -- --init`);
  if ([...(pw ?? "")].length < MIN_PASSWORD) throw new Error(`密码至少 ${MIN_PASSWORD} 位：密文是公开的，短密码能被一台电脑慢慢猜出来。几个随机的词连起来最好记`);
  const { file: keyFile, master } = await createKeyFile(pw);
  mkdirSync(vault, { recursive: true });
  writeFileSync(file, JSON.stringify(keyFile, null, 2) + "\n");
  return master;
}

const digest = (file) => (existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null);

/** albums/ 上次对上的那一版 index.enc 的指纹；换了 vault、没对上过返回 null */
export function syncedIndex(library, vault) {
  try {
    const state = JSON.parse(readFileSync(join(library, SYNC_FILE), "utf8"));
    return state.vault === resolve(vault) ? state.index : null;
  } catch {
    return null;
  }
}

/** 记下 albums/ 和现在的 vault 对上了；内容没变就不写（开发服务器盯着 albums/，写了会再触发一次加密） */
export function markSynced(library, vault) {
  const file = join(library, SYNC_FILE);
  const text = JSON.stringify({ vault: resolve(vault), index: digest(join(vault, "index.enc")) }) + "\n";
  if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
}

/** 解开后有多大：去掉文件头和每块的校验 */
function plainSize(file) {
  const total = statSync(file).size - 12;
  return total - 16 * Math.ceil(total / (CHUNK + 16));
}

/** 文件名缓存：开发服务器一直开着，没改过的文件不用每次重新算 */
const names = new Map();
/** 缩略图名字 → 它在目录里的样子（大小、宽高） */
const thumbs = new Map();
let ffmpegMissing = false;

/** 加密整个 albums/，返回加了几个图集、跳过了哪些、写了删了几个文件、vault 多大 */
export async function sealLibrary({ library = libraryDir(), vault = vaultDir(), password: pw = password(), init = false, force = false } = {}) {
  if (!pw) throw new Error("还没设密码：在 .env.local 里加一行 TIMELINE_PASSWORD=…（不进 git）");
  const lib = readLibrary(library);
  if (lib.problem) throw new Error(lib.problem);
  const v = await openVault(await openKey(vault, pw, { init }));
  const indexFile = join(vault, "index.enc");
  // albums/ 里没有的图集会从 vault 里删掉：albums/ 比 vault 旧（别的电脑更新过、刚 clone 下来）时这样做就把内容弄丢了
  if (!force && existsSync(indexFile) && syncedIndex(lib.dir, vault) !== digest(indexFile)) {
    throw new Error("vault 里的图集比 albums/ 新（git pull 来的，或者这台电脑还没解过）：先 npm run unseal 把它们解出来。确定要用 albums/ 盖掉 vault，加 --force");
  }
  const keyId = await blobName(v, new Uint8Array(0), "key-id");

  const blobs = join(vault, "blobs");
  mkdirSync(blobs, { recursive: true });
  const existing = new Set(readdirSync(blobs).filter((n) => BLOB.test(n)));
  const used = new Set();
  let written = 0;

  const nameOf = async (path, data, tag = "") => {
    const { mtimeMs, size } = statSync(path);
    const key = `${keyId}|${tag}|${resolve(path)}`;
    const hit = names.get(key);
    if (hit?.mtimeMs === mtimeMs && hit.size === size) return hit.name;
    const name = await blobName(v, data, tag);
    names.set(key, { mtimeMs, size, name });
    return name;
  };
  const put = async (name, data, extra) => {
    if (!existing.has(name)) {
      writeFileSync(join(blobs, name), await sealBytes(v, data));
      existing.add(name);
      written++;
    }
    used.add(name);
    return { blob: name, size: data.length, ...extra };
  };
  const media = async (path) => {
    const data = readFileSync(path);
    const ext = extname(path);
    const dims = ext === ".mp4" ? inspectVideo(data) : inspectPhoto(data);
    return put(await nameOf(path, data), data, { type: TYPES[ext], ...(dims && { w: dims.width, h: dims.height }) });
  };
  const thumb = async (path) => {
    const data = readFileSync(path);
    const name = await nameOf(path, data, `thumb${THUMB}`);
    if (existing.has(name)) {
      used.add(name);
      if (!thumbs.has(name)) {
        const dims = inspectPhoto(Buffer.from(await openBytes(v, readFileSync(join(blobs, name)))));
        thumbs.set(name, { blob: name, size: plainSize(join(blobs, name)), type: "image/jpeg", ...(dims && { w: dims.width, h: dims.height }) });
      }
      return thumbs.get(name);
    }
    let small = data;
    if (!ffmpegMissing) {
      const scratch = mkdtempSync(join(tmpdir(), "kid-growth-thumb-"));
      try {
        const out = join(scratch, "thumb.jpg");
        await run(process.env.FFMPEG_PATH || "ffmpeg", [
          "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", path,
          "-vf", `scale=${THUMB}:${THUMB}:force_original_aspect_ratio=increase,crop=${THUMB}:${THUMB}`,
          "-map_metadata", "-1", "-q:v", "4", out,
        ]);
        small = readFileSync(out);
      } catch (err) {
        if (/找不到/.test(err.message)) {
          ffmpegMissing = true;
          console.warn("没有 ffmpeg，缩略图直接用原图（页面会慢一点）");
        } else {
          console.warn(`缩略图没做出来，直接用原图：${path}\n  ${err.message}`);
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
    const dims = inspectPhoto(small);
    const ref = await put(name, small, { type: "image/jpeg", ...(dims && { w: dims.width, h: dims.height }) });
    thumbs.set(name, ref);
    return ref;
  };

  const skipped = [...lib.errors];
  const moments = [];
  const sorted = [...lib.moments].sort((a, b) => String(a.when?.date).localeCompare(String(b.when?.date)) || a.id.localeCompare(b.id));
  for (const m of sorted) {
    const dir = join(lib.dir, m.id);
    const problems = checkMoment(m, dir);
    if (problems.length) {
      skipped.push(...problems);
      continue;
    }
    const files = {};
    for (const name of mediaFiles(m)) files[name] = await media(join(dir, name));
    const cover = coverFile(m);
    const notesFile = join(dir, "notes.md");
    const notesData = readFileSync(notesFile);
    const notes = await put(await nameOf(notesFile, notesData), notesData, { type: "text/markdown" });
    moments.push({ ...m, files, thumb: await thumb(join(dir, cover)), notes });
  }

  const profileProblems = checkProfile(lib.profile, lib.dir, lib.moments);
  skipped.push(...profileProblems);
  const profile = profileProblems.length ? { name: "小念" } : lib.profile;
  const years = {};
  for (const [year, path] of Object.entries(profile.covers ?? {})) years[year] = await thumb(join(lib.dir, ...path.split("/")));

  const text = JSON.stringify({ v: 1, profile, years, moments });
  let changed = true;
  if (existsSync(indexFile)) {
    try {
      changed = new TextDecoder().decode(await openBytes(v, readFileSync(indexFile))) !== text;
    } catch {
      // 换过钥匙的旧 index，重写
    }
  }
  // 没变就不重写：每次加密的随机数不同，重写了 git 里就会多一次没意义的改动
  if (changed) writeFileSync(indexFile, await sealBytes(v, new TextEncoder().encode(text)));

  let removed = 0;
  for (const name of existing) {
    if (used.has(name)) continue;
    rmSync(join(blobs, name));
    removed++;
  }
  markSynced(lib.dir, vault);
  const bytes = [join(vault, "key.json"), indexFile, ...[...used].map((n) => join(blobs, n))].reduce((sum, f) => sum + statSync(f).size, 0);
  return { vault, moments: moments.length, skipped, written, removed, changed, bytes };
}

/** 给人看的一段报告 */
export function report(r) {
  const lines = [`vault：${r.vault}`, `${r.moments} 个图集，${(r.bytes / 1048576).toFixed(1)} MB；新加密 ${r.written} 个文件，删掉 ${r.removed} 个${r.changed ? "" : "，目录没变"}`];
  if (r.bytes > PAGES_LIMIT * 0.8) lines.push(`快到 GitHub Pages 的 1 GB 上限了：视频剪短一点，或者少放几段`);
  if (r.skipped.length) lines.push(`没加密（先修好，npm run check 看详情）：`, ...r.skipped.map((s) => `  - ${s}`));
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const rotate = args.includes("--rotate");
  if (rotate || args.includes("--new-password")) {
    const next = process.env.TIMELINE_NEW_PASSWORD;
    if ([...(next ?? "")].length < MIN_PASSWORD) throw new Error(`新密码放在环境变量 TIMELINE_NEW_PASSWORD 里，至少 ${MIN_PASSWORD} 位`);
    const master = await openKey(vaultDir(), password());
    if (rotate) {
      // 连主钥匙一起换：所有文件重新加密一遍，vault 在 git 里的体积会翻倍。先删 vault，所以图集必须都在本机
      const lib = readLibrary();
      if (lib.problem) throw new Error(`${lib.problem}\n--rotate 会删掉旧的 vault 重新加密，先 npm run unseal 把图集解回来`);
      const bad = lib.moments.filter((m) => checkMoment(m, join(lib.dir, m.id)).length);
      if (bad.length) throw new Error(`这些图集检查不过，重新加密会丢掉：${bad.map((m) => m.id).join("、")}；先 npm run check 修好`);
      rmSync(vaultDir(), { recursive: true, force: true });
      console.log(report(await sealLibrary({ password: next, init: true })));
    } else {
      writeFileSync(join(vaultDir(), "key.json"), JSON.stringify(await rewrapKeyFile(master, next), null, 2) + "\n");
      console.log("换好了。");
      console.log("注意：主钥匙没换。git 历史里旧的 key.json 还在，知道旧密码的人能从那里拿到主钥匙，以前和以后的内容都解得开。");
      console.log("密码真的泄露了，用 --rotate 连主钥匙一起换（所有文件重新加密，仓库会变大）。");
    }
    console.log("记得把 .env.local 里的 TIMELINE_PASSWORD 也改成新密码。");
    return;
  }
  const result = await sealLibrary({ init: args.includes("--init"), force: args.includes("--force") });
  console.log(report(result));
  console.log("提交：git add vault && git commit");
  if (result.skipped.length) process.exitCode = 1;
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
