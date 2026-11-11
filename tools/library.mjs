// 时光库：放照片、视频和每个瞬间的数据的文件夹，明文，在仓库外面，不进 git。
// 发布用的是加密后的 vault/（npm run seal），只有它进 git。
//
//   <时光库>/library.json             名字、生日、年份卡用哪张照片
//   <时光库>/<id>/moment.json + notes.md + 01.jpg、02.mp4 + 02.poster.jpg ……
//
//   npm run library                  看现在用的是哪个时光库、有几个瞬间
//   npm run library -- D:/小念/时光轴   换一个（写进 .env.local，没有就建好）
//
// 环境变量比 .env.local 优先：MOMENTS_DIR（时光库）、VAULT_DIR（默认仓库里的 vault/）、TIMELINE_PASSWORD（密码）。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(root, ".env.local");

export const ID = /^[a-z][a-z0-9-]*$/;

/** 环境变量，没有就读 .env.local 里同名的那一行 */
export function setting(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(ENV_FILE)) return null;
  const line = readFileSync(ENV_FILE, "utf8").split(/\r?\n/).find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2") || null : null;
}

/** 改 .env.local 里的一行（没有就加上） */
export function saveSetting(key, value) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split(/\r?\n/).filter((l) => l && !new RegExp(`^\\s*${key}\\s*=`).test(l)) : [];
  writeFileSync(ENV_FILE, [...lines, `${key}=${value}`, ""].join("\n"));
}

/** 时光库的绝对路径；没指定返回 null */
export function libraryDir() {
  const dir = setting("MOMENTS_DIR");
  return dir ? resolve(root, dir) : null;
}

/** 加密后的 vault：进 git、发布到网上的就是它 */
export const vaultDir = () => resolve(root, setting("VAULT_DIR") || "vault");

/** 看页面用的密码，只放在 .env.local 或环境变量里 */
export const password = () => setting("TIMELINE_PASSWORD");

/** 时光库能不能用：返回问题，能用返回 null */
export function libraryProblem(dir = libraryDir()) {
  if (!dir) return "还没指定时光库：npm run library -- <放照片和视频的文件夹>";
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return `时光库不存在：${dir}`;
  const rel = relative(root, dir);
  // 放在仓库里面也行，但必须被 git 忽略，不然明文的照片和视频会被提交上去
  // demo/library 是工具画的假素材，特意提交的
  if (!rel.startsWith("..") && !isAbsolute(rel) && rel.replaceAll("\\", "/") !== "demo/library") {
    const ignored = spawnSync("git", ["check-ignore", "-q", rel || "."], { cwd: root, windowsHide: true }).status === 0;
    if (!ignored) return `时光库在仓库里面又没被 .gitignore 忽略，明文的照片和视频会被提交上去：${dir}`;
  }
  return null;
}

/** 写东西之前用：时光库不能用就抛错 */
export function requireLibrary() {
  const dir = libraryDir();
  const problem = libraryProblem(dir);
  if (problem) throw new Error(problem);
  return dir;
}

/** 某个瞬间的目录 */
export const momentDir = (id, dir = requireLibrary()) => join(dir, id);

/** 读出时光库：library.json 和所有瞬间；读不出来的放进 errors，不影响别的 */
export function readLibrary(dir = libraryDir()) {
  const problem = libraryProblem(dir);
  const profile = { name: "小念" };
  if (problem) return { dir, problem, errors: [], profile, moments: [] };
  const moments = [];
  const errors = [];
  const profileFile = join(dir, "library.json");
  if (existsSync(profileFile)) {
    try {
      Object.assign(profile, JSON.parse(readFileSync(profileFile, "utf8")));
    } catch (err) {
      errors.push(`library.json 读不出来：${err.message}`);
    }
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const file = join(dir, entry.name, "moment.json");
    if (!existsSync(file)) continue;
    if (!ID.test(entry.name)) {
      errors.push(`${entry.name}：目录名只能用小写字母、数字和短横线`);
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
  const [target] = process.argv.slice(2);
  if (target) {
    const dir = resolve(target);
    mkdirSync(dir, { recursive: true });
    saveSetting("MOMENTS_DIR", dir.replaceAll("\\", "/"));
    if (process.env.MOMENTS_DIR) console.log("注意：环境变量 MOMENTS_DIR 比 .env.local 优先，先把它去掉");
  }
  const lib = readLibrary();
  if (lib.problem) {
    console.error(lib.problem);
    process.exit(1);
  }
  console.log(`时光库：${lib.dir}`);
  console.log(`${lib.moments.length} 个瞬间${lib.moments.length ? "" : "，npm run moment:new -- <id> <照片或原片> 收第一个"}`);
  console.log(`加密到：${vaultDir()}${password() ? "" : "（还没设密码：在 .env.local 里加一行 TIMELINE_PASSWORD=…）"}`);
  for (const e of lib.errors) console.error(`✗ ${e}`);
}

const entry = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) main();
