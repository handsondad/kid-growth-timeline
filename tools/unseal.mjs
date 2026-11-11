// 把 vault/ 解回 albums/：换了电脑、git pull 了别的电脑做的图集，先跑这个再接着做。
//
//   npm run unseal              vault 里有、albums/ 里没有的图集解出来；两边一样的不动；两边不一样的列出来，不动
//   npm run unseal -- --force   两边不一样的，用 vault 里的盖掉 albums/ 里的
//
// 要 .env.local 里的 TIMELINE_PASSWORD。解出来的照片、视频和加密前一个字节都不差，再 seal 不会改动 vault。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openBytes, openVault } from "../src/vault/crypto.ts";
import { libraryDir, libraryProblem, password, PROFILE_FILE, readLibrary, vaultDir } from "./library.mjs";
import { markSynced, openKey } from "./seal.mjs";

const json = (data) => JSON.stringify(data, null, 2) + "\n";
/** 键的顺序、缩进不一样也算同一份 JSON */
const canonical = (value) =>
  Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
      : value;
const sameJson = (file, data) => {
  try {
    return JSON.stringify(canonical(JSON.parse(readFileSync(file, "utf8")))) === JSON.stringify(canonical(data));
  } catch {
    return false;
  }
};
const sameBytes = (file, data) => existsSync(file) && readFileSync(file).equals(data);

/** 解回来，返回解出来的、本来就一样的、两边不一样的图集，和只在 albums/ 里有的 */
export async function unsealLibrary({ library = libraryDir(), vault = vaultDir(), password: pw = password(), force = false } = {}) {
  if (!pw) throw new Error("还没设密码：在 .env.local 里加一行 TIMELINE_PASSWORD=…（和加密时用的同一个）");
  if (!existsSync(join(vault, "key.json")) || !existsSync(join(vault, "index.enc"))) throw new Error(`${vault} 里还没有加密好的图集`);
  const v = await openVault(await openKey(vault, pw));
  const index = JSON.parse(new TextDecoder().decode(await openBytes(v, readFileSync(join(vault, "index.enc")))));
  const read = async (ref) => Buffer.from(await openBytes(v, readFileSync(join(vault, "blobs", ref.blob))));

  mkdirSync(library, { recursive: true });
  const problem = libraryProblem(library);
  if (problem) throw new Error(problem);

  const restored = [];
  const same = [];
  const differ = [];
  const profileFile = join(library, PROFILE_FILE);
  const sameValue = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  if (!existsSync(profileFile) || force) writeFileSync(profileFile, json(index.profile));
  else if (!sameValue(readLibrary(library).profile, index.profile)) differ.push(PROFILE_FILE);

  for (const { id, files, thumb, notes, ...data } of index.moments) {
    const dir = join(library, id);
    const wanted = [["notes.md", notes ? await read(notes) : Buffer.from(`# ${id}\n`)]];
    for (const [name, ref] of Object.entries(files)) wanted.push([name, await read(ref)]);
    const fresh = !existsSync(join(dir, "moment.json"));
    const unchanged = !fresh && sameJson(join(dir, "moment.json"), data) && wanted.every(([name, bytes]) => sameBytes(join(dir, name), bytes));
    if (unchanged) {
      same.push(id);
      continue;
    }
    if (!fresh && !force) {
      differ.push(id);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "moment.json"), json(data));
    for (const [name, bytes] of wanted) writeFileSync(join(dir, name), bytes);
    restored.push(id);
  }

  const sealed = new Set(index.moments.map((m) => m.id));
  const extra = readLibrary(library).moments.map((m) => m.id).filter((id) => !sealed.has(id));
  // 两边还有不一样的，就还没对上：seal 会拦着，等大人决定用哪边
  if (!differ.length) markSynced(library, vault);
  return { library, restored, same, differ, extra };
}

async function main() {
  const r = await unsealLibrary({ force: process.argv.includes("--force") });
  console.log(`albums：${r.library}`);
  console.log(`解出来 ${r.restored.length} 个${r.restored.length ? `：${r.restored.join("、")}` : ""}；本来就一样 ${r.same.length} 个`);
  if (r.differ.length) {
    console.log(`两边不一样，没动：${r.differ.join("、")}`);
    console.log("用 vault 里的：npm run unseal -- --force；用这台电脑上的：npm run seal -- --force");
    process.exitCode = 1;
  }
  if (r.extra.length) console.log(`只在 albums/ 里有（新做的，或者别的电脑上删掉了）：${r.extra.join("、")}`);
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
