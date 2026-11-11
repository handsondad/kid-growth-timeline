/**
 * vault 的加密：浏览器解、Node 加（tools/seal.mjs），用的是同一份代码，都走 WebCrypto。
 *
 * - 密码 → Argon2id（故意算得慢、吃内存，拿到密文的人猜密码很贵）→ 一把「包钥匙的钥匙」
 * - 真正加密文件的是一把随机主钥匙，被包好放在 vault/key.json；换密码只要重新包一次
 * - 主钥匙用 HKDF 分出两把：AES-256-GCM 加文件，HMAC 给文件起名（同一个文件名字不变，不知道钥匙就对不上是哪张照片）
 * - 文件按 1 MB 切块加密，每块单独校验；最后一块打标记，被截短了解得出来
 */
import { argon2id } from "hash-wasm";

export type Kdf = { readonly name: "argon2id"; readonly salt: string; readonly iterations: number; readonly memory: number; readonly parallelism: number };
export type KeyFile = { readonly v: 1; readonly kdf: Kdf; readonly wrapped: { readonly iv: string; readonly data: string } };
export type Vault = { readonly aes: CryptoKey; readonly mac: CryptoKey };

export const CHUNK = 1 << 20;
/** 手机上一秒左右：3 轮、64 MB */
export const KDF_COST = { iterations: 3, memory: 64 * 1024, parallelism: 1 } as const;
const MAGIC = [0x4b, 0x47, 0x54, 0x31]; // KGT1
const HEAD = MAGIC.length + 8;
const TAG = 16;

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export class WrongPassword extends Error {
  constructor() {
    super("密码不对");
  }
}

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function passwordKey(password: string, kdf: Kdf): Promise<CryptoKey> {
  const raw = await argon2id({
    password: password.normalize("NFC"),
    salt: fromB64(kdf.salt),
    iterations: kdf.iterations,
    memorySize: kdf.memory,
    parallelism: kdf.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
  return subtle.importKey("raw", new Uint8Array(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

const WRAP_AAD = enc.encode("kgt-master-key");

async function wrap(master: Uint8Array<ArrayBuffer>, password: string): Promise<KeyFile> {
  const kdf: Kdf = { name: "argon2id", salt: toB64(random(16)), ...KDF_COST };
  const iv = random(12);
  const data = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv, additionalData: WRAP_AAD }, await passwordKey(password, kdf), master));
  return { v: 1, kdf, wrapped: { iv: toB64(iv), data: toB64(data) } };
}

/** 第一次：生成主钥匙，用密码包好 */
export async function createKeyFile(password: string): Promise<{ file: KeyFile; master: Uint8Array<ArrayBuffer> }> {
  const master = random(32);
  return { file: await wrap(master, password), master };
}

/** 换密码：主钥匙不变，重新包一次 */
export const rewrapKeyFile = (master: Uint8Array<ArrayBuffer>, password: string) => wrap(master, password);

/** 用密码解开主钥匙；密码不对抛 WrongPassword */
export async function unwrapMaster(file: KeyFile, password: string): Promise<Uint8Array<ArrayBuffer>> {
  if (file?.v !== 1 || file.kdf?.name !== "argon2id") throw new Error("vault/key.json 的格式认不出来");
  const key = await passwordKey(password, file.kdf);
  try {
    const iv = fromB64(file.wrapped.iv);
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv, additionalData: WRAP_AAD }, key, fromB64(file.wrapped.data)));
  } catch {
    throw new WrongPassword();
  }
}

export async function openVault(master: Uint8Array<ArrayBuffer>): Promise<Vault> {
  const base = await subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
  const derive = (info: string, alg: AesKeyGenParams | HmacKeyGenParams, usage: KeyUsage[]) =>
    subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode(info) }, base, alg, false, usage);
  return {
    aes: await derive("kgt-files", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]),
    mac: await derive("kgt-names", { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign"]),
  };
}

/** 加密文件的名字：同样的内容（和同样的 tag）总是同一个名字 */
export async function blobName(vault: Vault, data: Uint8Array<ArrayBuffer>, tag = ""): Promise<string> {
  const head = enc.encode(`${tag}\0`);
  const all = new Uint8Array(head.length + data.length);
  all.set(head);
  all.set(data, head.length);
  const sig = new Uint8Array(await subtle.sign("HMAC", vault.mac, all));
  return [...sig.subarray(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ivFor = (prefix: Uint8Array, i: number) => {
  const iv = new Uint8Array(12);
  iv.set(prefix);
  new DataView(iv.buffer).setUint32(8, i);
  return iv;
};
const lastFlag = (last: boolean) => new Uint8Array([last ? 1 : 0]);

/** 加密：KGT1 + 8 字节随机前缀 + 一块一块（每块后面带 16 字节校验） */
export async function sealBytes(vault: Vault, data: Uint8Array<ArrayBuffer>, chunk = CHUNK): Promise<Uint8Array<ArrayBuffer>> {
  const prefix = random(8);
  const count = Math.max(1, Math.ceil(data.length / chunk));
  const out = new Uint8Array(HEAD + data.length + count * TAG);
  out.set(MAGIC);
  out.set(prefix, MAGIC.length);
  let at = HEAD;
  for (let i = 0; i < count; i++) {
    const part = data.subarray(i * chunk, (i + 1) * chunk);
    const sealed = await subtle.encrypt({ name: "AES-GCM", iv: ivFor(prefix, i), additionalData: lastFlag(i === count - 1) }, vault.aes, part);
    out.set(new Uint8Array(sealed), at);
    at += sealed.byteLength;
  }
  return out;
}

/** 解密；被改过、被截短、钥匙不对都会抛错。onProgress 给 0～1 */
export async function openBytes(vault: Vault, data: Uint8Array<ArrayBuffer>, onProgress?: (done: number) => void, chunk = CHUNK): Promise<Uint8Array<ArrayBuffer>> {
  if (data.length < HEAD + TAG || MAGIC.some((b, i) => data[i] !== b)) throw new Error("不是 vault 里的加密文件");
  const prefix = data.subarray(MAGIC.length, HEAD);
  const count = Math.ceil((data.length - HEAD) / (chunk + TAG));
  const out = new Uint8Array(data.length - HEAD - count * TAG);
  let from = HEAD;
  let to = 0;
  for (let i = 0; i < count; i++) {
    const part = data.subarray(from, Math.min(from + chunk + TAG, data.length));
    let plain: ArrayBuffer;
    try {
      plain = await subtle.decrypt({ name: "AES-GCM", iv: ivFor(prefix, i), additionalData: lastFlag(i === count - 1) }, vault.aes, part);
    } catch {
      throw new Error("解不开：文件坏了，或者不是这把钥匙加密的");
    }
    out.set(new Uint8Array(plain), to);
    from += part.length;
    to += plain.byteLength;
    onProgress?.((i + 1) / count);
  }
  return out;
}
