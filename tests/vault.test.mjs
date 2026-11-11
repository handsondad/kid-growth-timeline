import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  blobName, createKeyFile, openBytes, openVault, rewrapKeyFile, sealBytes, unwrapMaster, WrongPassword,
} from "../src/vault/crypto.ts";
import { root } from "../tools/library.mjs";
import { openKey, sealLibrary } from "../tools/seal.mjs";
import { add, GOOD, JPEG, makeLibrary } from "./fixtures.mjs";

const PASSWORD = "correct horse battery";
// 假 JPEG 解不出画面，不让 ffmpeg 做缩略图（直接用原图）
process.env.FFMPEG_PATH = join(tmpdir(), "no-ffmpeg-here");

const bytes = (n) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) & 0xff);
const vaultOf = async () => openVault((await createKeyFile(PASSWORD)).master);

test("加密再解开还是原样：空的、刚好整块、多出半块；进度走到 1", async () => {
  const v = await vaultOf();
  for (const n of [0, 1, 64, 100, 129]) {
    const plain = bytes(n);
    const sealed = await sealBytes(v, plain, 64);
    const progress = [];
    assert.deepEqual(await openBytes(v, sealed, (d) => progress.push(d), 64), plain);
    assert.equal(progress[progress.length - 1], 1);
  }
  const a = await sealBytes(v, bytes(10));
  const b = await sealBytes(v, bytes(10));
  assert.notDeepEqual(a, b, "同一个文件每次加密出来不一样");
});

test("被改了一个字节、截掉一块、两块换了位置、钥匙不对，都解不开", async () => {
  const v = await vaultOf();
  const sealed = await sealBytes(v, bytes(200), 64);
  const flipped = sealed.slice();
  flipped[40] ^= 1;
  await assert.rejects(openBytes(v, flipped, undefined, 64), /解不开/);
  await assert.rejects(openBytes(v, sealed.slice(0, sealed.length - (8 + 16)), undefined, 64), /解不开/);
  await assert.rejects(openBytes(v, sealed.slice(0, 12 + 2 * (64 + 16)), undefined, 64), /解不开/);
  const swapped = sealed.slice();
  swapped.set(sealed.subarray(12, 12 + 80), 12 + 80);
  swapped.set(sealed.subarray(12 + 80, 12 + 160), 12);
  await assert.rejects(openBytes(v, swapped, undefined, 64), /解不开/);
  await assert.rejects(openBytes(await vaultOf(), sealed, undefined, 64), /解不开/);
  await assert.rejects(openBytes(v, new Uint8Array(40)), /不是 vault 里的加密文件/);
});

test("钥匙：对的密码解得开，错的不行；换密码主钥匙不变", async () => {
  const { file, master } = await createKeyFile(PASSWORD);
  assert.equal(file.kdf.name, "argon2id");
  assert.deepEqual(await unwrapMaster(file, PASSWORD), master);
  await assert.rejects(unwrapMaster(file, "wrong password!!"), WrongPassword);
  const next = await rewrapKeyFile(master, "another long password");
  assert.notEqual(next.kdf.salt, file.kdf.salt);
  assert.deepEqual(await unwrapMaster(next, "another long password"), master);
  await assert.rejects(unwrapMaster(next, PASSWORD), WrongPassword);
});

test("文件名：同一把钥匙、同样的内容总是同一个名字，不同钥匙对不上", async () => {
  const v = await vaultOf();
  const name = await blobName(v, bytes(50));
  assert.match(name, /^[0-9a-f]{32}$/);
  assert.equal(await blobName(v, bytes(50)), name);
  assert.notEqual(await blobName(v, bytes(50), "thumb360"), name);
  assert.notEqual(await blobName(await vaultOf(), bytes(50)), name);
});

const decrypt = async (vault, file) => openBytes(await openVault(await openKey(vault, PASSWORD)), readFileSync(file));
const readIndex = async (vault) => JSON.parse(new TextDecoder().decode(await decrypt(vault, join(vault, "index.enc"))));
const allBytes = (vault) => Buffer.concat([readFileSync(join(vault, "index.enc")), ...readdirSync(join(vault, "blobs")).map((n) => readFileSync(join(vault, "blobs", n)))]);

test("加密时光库：只放密文；没改就不重写；删掉的跟着删；检查不过的不加密", async () => {
  const library = makeLibrary();
  const vault = mkdtempSync(join(tmpdir(), "kid-growth-vault-"));
  try {
    await assert.rejects(sealLibrary({ library, vault, password: PASSWORD }), /seal -- --init/);
    await assert.rejects(sealLibrary({ library, vault, password: "short", init: true }), /至少 12 位/);

    const first = await sealLibrary({ library, vault, password: PASSWORD, init: true });
    assert.equal(first.moments, 1);
    assert.deepEqual(first.skipped, []);
    assert.equal(first.written, 2, "照片和缩略图");
    const index = await readIndex(vault);
    assert.deepEqual(index.profile, { name: "小念", birthday: "2022-09-08" });
    assert.deepEqual(Object.keys(index.years), ["2026"]);
    const [moment] = index.moments;
    assert.equal(moment.title, GOOD.title);
    assert.equal(moment.files["01.jpg"].w, 900);
    assert.equal(moment.files["01.jpg"].h, 1200);
    assert.deepEqual(Buffer.from(await decrypt(vault, join(vault, "blobs", moment.files["01.jpg"].blob))), JPEG);
    const sealed = allBytes(vault);
    assert.ok(!sealed.includes(Buffer.from(GOOD.title)) && !sealed.includes(JPEG.subarray(0, 20)), "vault 里没有明文");
    assert.ok(!readdirSync(vault).includes("notes.md"));

    const indexBefore = readFileSync(join(vault, "index.enc"));
    const again = await sealLibrary({ library, vault, password: PASSWORD });
    assert.deepEqual([again.written, again.removed, again.changed], [0, 0, false]);
    assert.deepEqual(readFileSync(join(vault, "index.enc")), indexBefore);

    await assert.rejects(sealLibrary({ library, vault, password: "wrong password!!" }), WrongPassword);

    add(library, "half-done", { "moment.json": JSON.stringify({ ...GOOD, title: "" }), "notes.md": "" });
    writeFileSync(join(library, "first-bike", "moment.json"), JSON.stringify({ ...GOOD, title: "骑车" }));
    const edited = await sealLibrary({ library, vault, password: PASSWORD });
    assert.equal(edited.changed, true);
    assert.equal(edited.written, 0);
    assert.match(edited.skipped.join(), /half-done title：不能空着/);
    assert.deepEqual((await readIndex(vault)).moments.map((m) => m.title), ["骑车"]);

    rmSync(join(library, "first-bike"), { recursive: true });
    rmSync(join(library, "library.json"));
    const emptied = await sealLibrary({ library, vault, password: PASSWORD });
    assert.equal(emptied.removed, 2);
    assert.deepEqual(readdirSync(join(vault, "blobs")), []);
    assert.deepEqual((await readIndex(vault)).moments, []);
  } finally {
    rmSync(library, { recursive: true, force: true });
    rmSync(vault, { recursive: true, force: true });
  }
});

test("开发服务器：只给 vault 里的密文（支持分段），明文的时光库一个字节都不给", async () => {
  const library = makeLibrary();
  const vault = mkdtempSync(join(tmpdir(), "kid-growth-vault-"));
  const env = { MOMENTS_DIR: library, VAULT_DIR: vault, KGT_AUTOSEAL: "0" };
  const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  await sealLibrary({ library, vault, password: PASSWORD, init: true });
  const { createServer } = await import("vite");
  const server = await createServer({ root, logLevel: "error", server: { port: 0, open: false } });
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0];
    const key = await (await fetch(`${base}vault/key.json`)).json();
    assert.equal(key.kdf.name, "argon2id");
    const index = await fetch(`${base}vault/index.enc`);
    assert.equal(index.status, 200);
    assert.deepEqual(Buffer.from(await index.arrayBuffer()), readFileSync(join(vault, "index.enc")));

    const [blob] = readdirSync(join(vault, "blobs"));
    const whole = readFileSync(join(vault, "blobs", blob));
    const part = await fetch(`${base}vault/blobs/${blob}`, { headers: { Range: "bytes=2-5" } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), `bytes 2-5/${whole.length}`);
    assert.deepEqual(Buffer.from(await part.arrayBuffer()), whole.subarray(2, 6));
    assert.equal((await fetch(`${base}vault/blobs/${"0".repeat(32)}`)).status, 404);

    const plain = library.replaceAll("\\", "/");
    for (const path of ["moments/index.json", "moments/first-bike/01.jpg", "vault/../library.json", `@fs/${plain}/first-bike/notes.md`, `@fs/${plain}/first-bike/01.jpg`]) {
      const body = Buffer.from(await (await fetch(`${base}${path}`)).arrayBuffer());
      for (const secret of [Buffer.from(GOOD.title), Buffer.from("# first-bike"), Buffer.from("2022-09-08"), JPEG.subarray(0, 20)]) {
        assert.ok(!body.includes(secret), `${path} 不该给出去`);
      }
    }
  } finally {
    await server.close();
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(library, { recursive: true, force: true });
    rmSync(vault, { recursive: true, force: true });
  }
});

test("仓库里的 vault 如果有，钥匙文件格式对", () => {
  const file = join(root, "vault", "key.json");
  if (!existsSync(file)) return;
  const key = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(key.v, 1);
  assert.equal(key.kdf.name, "argon2id");
  assert.ok(key.kdf.memory >= 64 * 1024);
});
