// 图集：项目里的 albums/，一件事一个文件夹，明文，只在这台电脑上，不进 git。
// 进 git、发布的是它加密后的 vault/（npm run seal）；换台电脑用 npm run unseal 从 vault 解回来。
//
//   albums/profile.json                 名字、生日、年份卡用哪张照片
//   albums/<id>/moment.json + notes.md + 01.jpg、02.mp4 + 02.poster.jpg ……
//
//   npm run status                      图集在哪、有几个，vault 在哪，密码设了没有
//
// 环境变量比 .env.local 优先：TIMELINE_PASSWORD（密码）、ALBUMS_DIR（默认 albums/）、VAULT_DIR（默认 vault/）。
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(root, ".env.local");

export const ID = /^[a-z][a-z0-9-]*$/;
export const PROFILE_FILE = "profile.json";

/** 环境变量，没有就读 .env.local 里同名的那一行 */
export function setting(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(ENV_FILE)) return null;
  const line = readFileSync(ENV_FILE, "utf8").split(/\r?\n/).find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2") || null : null;
}

/** 图集文件夹（明文） */
export const libraryDir = () => resolve(root, setting("ALBUMS_DIR") || "albums");

/** 加密后的 vault：进 git、发布到网上的就是它 */
export const vaultDir = () => resolve(root, setting("VAULT_DIR") || "vault");

/** 看页面用的密码，只放在 .env.local 或环境变量里 */
export const password = () => setting("TIMELINE_PASSWORD");

/** 图集文件夹能不能用：返回问题，能用返回 null */
export function libraryProblem(dir = libraryDir()) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return `还没有图集文件夹 ${dir}：照着规划好的成长节点开始 npm run starter；新做一个 npm run album:new -- <id> <照片…>；vault 里已经有加密好的图集就 npm run unseal`;
  const rel = relative(root, dir);
  // 放在项目里必须被 git 忽略，不然明文的照片和视频会被提交上去
  if (!rel.startsWith("..") && !isAbsolute(rel)) {
    const ignored = spawnSync("git", ["check-ignore", "-q", rel || "."], { cwd: root, windowsHide: true }).status === 0;
    if (!ignored) return `图集文件夹在项目里面又没被 .gitignore 忽略，明文的照片和视频会被提交上去：${dir}`;
  }
  return null;
}

/** 某个图集的文件夹 */
export const momentDir = (id, dir = libraryDir()) => join(dir, id);

/** 读出所有图集和 profile.json；读不出来的放进 errors，不影响别的。tracked：读进 git 的 starter/（只有文字），不查忽略 */
export function readLibrary(dir = libraryDir(), { tracked = false } = {}) {
  const problem = tracked ? (existsSync(dir) ? null : `没有 ${dir}`) : libraryProblem(dir);
  const profile = { name: "小念" };
  if (problem) return { dir, problem, errors: [], profile, moments: [] };
  const moments = [];
  const errors = [];
  const profileFile = join(dir, PROFILE_FILE);
  if (existsSync(profileFile)) {
    try {
      Object.assign(profile, JSON.parse(readFileSync(profileFile, "utf8")));
    } catch (err) {
      errors.push(`${PROFILE_FILE} 读不出来：${err.message}`);
    }
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const file = join(dir, entry.name, "moment.json");
    if (!existsSync(file)) continue;
    if (!ID.test(entry.name)) {
      errors.push(`${entry.name}：文件夹名只能用小写字母、数字和短横线`);
      continue;
    }
    try {
      moments.push({ ...JSON.parse(readFileSync(file, "utf8")), id: entry.name });
    } catch (err) {
      errors.push(`${entry.name}/moment.json 读不出来：${err.message}`);
    }
  }
  return { dir, problem: null, errors, profile, moments };
}

function main() {
  const lib = readLibrary();
  const vault = vaultDir();
  const sealed = existsSync(join(vault, "key.json"));
  console.log(`图集：${lib.dir}${lib.problem ? `\n  ${lib.problem}` : `，${lib.moments.length} 个`}`);
  console.log(`vault：${vault}${sealed ? "" : "（还没有：npm run seal -- --init）"}`);
  console.log(`密码：${password() ? "设了" : "还没设：在 .env.local 里加一行 TIMELINE_PASSWORD=…（至少 12 位，不进 git）"}`);
  if (lib.problem && sealed) console.log("vault 里已经有加密好的图集：npm run unseal 解回 albums/");
  for (const e of lib.errors) console.error(`✗ ${e}`);
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) main();
