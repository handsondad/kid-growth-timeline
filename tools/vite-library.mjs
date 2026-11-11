// 让页面读到加密的 vault：开发时 /vault/key.json、/vault/index.enc、/vault/blobs/<名字> 从 vault 目录给出，
// 时光库一改就自动加密一遍（同 npm run seal），页面自己刷新；构建时把 vault 复制进 dist/vault，GitHub Pages 发布的就是它。
// 明文的时光库不经过这里。
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { libraryDir, libraryProblem, password, vaultDir } from "./library.mjs";
import { report, sealLibrary } from "./seal.mjs";

const FILE = /^\/vault\/(key\.json|index\.enc|blobs\/[0-9a-f]{32})$/;

/** 「bytes=100-199」「bytes=-500」「bytes=100-」→ 起止；不合法返回 null，超出范围返回 "unsatisfiable" */
export function byteRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  let start;
  let end;
  if (!m[1]) {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return "unsatisfiable";
  return { start, end };
}

function sendFile(req, res, file, type) {
  const { size } = statSync(file);
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");
  const range = byteRange(req.headers.range, size);
  if (range === "unsatisfiable") {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${size}`);
    res.end();
    return;
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  if (range) {
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  res.setHeader("Content-Length", end - start + 1);
  if (req.method === "HEAD" || size === 0) {
    res.end();
    return;
  }
  createReadStream(file, { start, end }).pipe(res);
}

function middleware(req, res, next) {
  const m = FILE.exec((req.url ?? "").split("?")[0]);
  if (!m) return next();
  const file = join(vaultDir(), ...m[1].split("/"));
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  sendFile(req, res, file, m[1] === "key.json" ? "application/json" : "application/octet-stream");
}

/** 开发时跟着时光库自动加密：同一时间只跑一次，跑的时候又改了就再跑一次 */
function autoSeal(server) {
  const log = server.config.logger;
  const lib = libraryDir();
  const problem = libraryProblem(lib) ?? (password() ? null : "还没设密码，不会自动加密：在 .env.local 里加一行 TIMELINE_PASSWORD=…");
  if (problem) {
    log.warn(`${problem}\n页面显示的是 ${vaultDir()} 里已经加密好的内容`);
    return;
  }
  let running = false;
  let again = false;
  let timer = null;
  const seal = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const r = await sealLibrary();
      log.info(report(r), { timestamp: true });
      if (r.changed || r.written || r.removed) server.ws.send({ type: "full-reload" });
    } catch (err) {
      log.error(`加密没成功：${err.message}`, { timestamp: true });
    } finally {
      running = false;
      if (again) {
        again = false;
        seal();
      }
    }
  };
  seal();
  server.watcher.add(lib);
  const changed = (file) => {
    if (!resolve(file).startsWith(lib)) return;
    clearTimeout(timer);
    timer = setTimeout(seal, 400);
  };
  for (const event of ["add", "change", "unlink"]) server.watcher.on(event, changed);
}

export function momentLibrary() {
  let outDir = "dist";
  let building = false;
  return {
    name: "moment-vault",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      building = config.command === "build";
    },
    configureServer(server) {
      server.middlewares.use(middleware);
      // 截图、测试起的服务器设 KGT_AUTOSEAL=0，只读现成的 vault
      if (process.env.KGT_AUTOSEAL !== "0") autoSeal(server);
    },
    closeBundle() {
      // 开发服务器关掉时也会调到这里
      if (!building) return;
      const vault = vaultDir();
      if (!existsSync(join(vault, "key.json"))) {
        this.warn(`${vault} 里还没有加密的内容：npm run seal -- --init`);
        return;
      }
      const target = join(outDir, "vault");
      mkdirSync(join(target, "blobs"), { recursive: true });
      for (const name of ["key.json", "index.enc"]) if (existsSync(join(vault, name))) copyFileSync(join(vault, name), join(target, name));
      const blobs = existsSync(join(vault, "blobs")) ? readdirSync(join(vault, "blobs")).filter((n) => /^[0-9a-f]{32}$/.test(n)) : [];
      for (const name of blobs) copyFileSync(join(vault, "blobs", name), join(target, "blobs", name));
      console.log(`vault：${blobs.length} 个加密文件复制进了 ${target}`);
    },
  };
}
