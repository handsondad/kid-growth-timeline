/**
 * 页面读加密的 vault：vault/key.json（被密码包着的钥匙）、vault/index.enc（所有图集）、vault/blobs/（照片视频）。
 * 输对密码在浏览器里解开；解开的照片只放在内存里，关掉页面就没了。都是相对路径，GitHub Pages 上也一样。
 */
import type { FileRef, Library } from "./moment/types.ts";
import { fromB64, loadKdf, openBytes, openVault, toB64, unwrapMaster, type KeyFile, type Vault } from "./vault/crypto.ts";

const SAVED = "kgt-key";
let vault: Vault | null = null;

/** index.enc 是加密的，没解锁也能先下载：和 key.json 一起下，输密码、解钥匙的时候它已经到了。没下载成功下次重新下 */
let indexJob: Promise<Uint8Array<ArrayBuffer>> | null = null;
function fetchIndex(): Promise<Uint8Array<ArrayBuffer>> {
  indexJob ??= fetch("vault/index.enc", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`读不到 vault/index.enc（${res.status}）`);
      return new Uint8Array(await res.arrayBuffer());
    })
    .catch((err) => {
      indexJob = null;
      throw err;
    });
  return indexJob;
}

/** vault 还没生成（没有 key.json）返回 null */
export async function fetchKeyFile(): Promise<KeyFile | null> {
  fetchIndex().catch(() => {});
  const res = await fetch("vault/key.json", { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`读不到 vault/key.json（${res.status}）`);
  return res.json();
}

/** 停在输密码时先把解锁用的程序下好，点「打开」不用再等 */
export const preloadUnlock = () => {
  loadKdf().catch(() => {});
  fetchIndex().catch(() => {});
};

async function open(master: Uint8Array<ArrayBuffer>): Promise<Library> {
  const [v, data] = await Promise.all([openVault(master), fetchIndex()]);
  const library: Library = JSON.parse(new TextDecoder().decode(await openBytes(v, data)));
  vault = v;
  return library;
}

function forget() {
  sessionStorage.removeItem(SAVED);
  localStorage.removeItem(SAVED);
}

/** 输密码解锁；remember 记在这台设备上（不勾就只记到关掉浏览器） */
export async function unlock(file: KeyFile, password: string, remember: boolean): Promise<Library> {
  const master = await unwrapMaster(file, password);
  const library = await open(master);
  forget();
  (remember ? localStorage : sessionStorage).setItem(SAVED, JSON.stringify({ salt: file.kdf.salt, key: toB64(master) }));
  return library;
}

/** 记住过就直接打开；换过密码（salt 变了）就忘掉，要重新输 */
export async function resume(file: KeyFile): Promise<Library | null> {
  const text = sessionStorage.getItem(SAVED) ?? localStorage.getItem(SAVED);
  if (!text) return null;
  try {
    const saved = JSON.parse(text);
    if (saved.salt !== file.kdf.salt) throw new Error("密码换过了");
    return await open(fromB64(saved.key));
  } catch {
    forget();
    return null;
  }
}

/** 锁上：忘掉钥匙，回到输密码 */
export function lock() {
  forget();
  location.hash = "#/";
  location.reload();
}

/** 解开的照片留在内存里，同一张不解第二次；多了就把最久没用的扔掉 */
const cache = new Map<string, Promise<string>>();
const CACHE_MAX = 150;

async function download(res: Response, size: number, onProgress?: (done: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  if (!onProgress || !res.body) return new Uint8Array(await res.arrayBuffer());
  const total = Number(res.headers.get("content-length")) || size;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** 解开一个加密文件，给出能放进 <img>/<video> 的地址。视频不缓存，用完要 URL.revokeObjectURL */
export function fileUrl(ref: FileRef, onProgress?: (done: number) => void): Promise<string> {
  const keep = !ref.type.startsWith("video/");
  const hit = keep ? cache.get(ref.blob) : undefined;
  if (hit) {
    cache.delete(ref.blob);
    cache.set(ref.blob, hit);
    return hit;
  }
  const job = (async () => {
    if (!vault) throw new Error("还没解锁");
    const res = await fetch(`vault/blobs/${ref.blob}`);
    if (!res.ok) throw new Error(`读不到加密文件（${res.status}）`);
    const data = await download(res, ref.size, onProgress && ((d) => onProgress(d * 0.9)));
    const plain = await openBytes(vault, data, onProgress && ((d) => onProgress(0.9 + d * 0.1)));
    return URL.createObjectURL(new Blob([plain], { type: ref.type }));
  })();
  if (keep) {
    cache.set(ref.blob, job);
    job.catch(() => cache.delete(ref.blob));
    while (cache.size > CACHE_MAX) {
      const [oldest, url] = cache.entries().next().value!;
      cache.delete(oldest);
      url.then((u) => URL.revokeObjectURL(u), () => {});
    }
  }
  return job;
}

/** 《小念家的漫画书》里同一天的故事 */
export const storyUrl = (id: string) => `https://handsondad.github.io/storyverse/#/read/${id}/0`;
/** 《小念的画廊》里同一天的作品 */
export const workUrl = (id: string) => `https://handsondad.github.io/kids-gallery/#/work/${id}`;
