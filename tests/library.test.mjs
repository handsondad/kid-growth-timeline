import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { libraryProblem, readLibrary, root } from "../tools/library.mjs";
import { byteRange } from "../tools/vite-library.mjs";
import { checkMoment, checkProfile } from "./moment-rules.mjs";
import { add, JPEG, makeLibrary } from "./fixtures.mjs";

test("时光库：按目录读出瞬间，id 是目录名；读不出来的单独列出，不影响别的", () => {
  const dir = makeLibrary();
  try {
    add(dir, "broken-json", { "moment.json": "{ title: " });
    add(dir, "Bad_Name", { "moment.json": "{}" });
    add(dir, "just-a-folder", { "readme.txt": "不是瞬间" });
    const lib = readLibrary(dir);
    assert.equal(lib.problem, null);
    assert.deepEqual(lib.moments.map((m) => m.id), ["first-bike"]);
    assert.equal(lib.moments[0].title, "第一次骑车");
    assert.equal(lib.errors.length, 2);
    assert.match(lib.errors.join("\n"), /broken-json/);
    assert.match(lib.errors.join("\n"), /Bad_Name/);
    assert.deepEqual(lib.profile, { name: "小念", birthday: "2022-09-08", covers: { 2026: "first-bike/01.jpg" } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("时光库：没指定、不存在、放在仓库里又没被忽略，都用不了", () => {
  assert.match(libraryProblem(null), /还没指定/);
  assert.match(libraryProblem(join(tmpdir(), "no-such-library-here")), /不存在/);
  assert.match(libraryProblem(join(root, "src")), /没被 \.gitignore 忽略/);
  assert.equal(libraryProblem(join(root, "node_modules")), null);
  assert.match(readLibrary(null).problem, /还没指定/);
  assert.deepEqual(readLibrary(null).profile, { name: "小念" });
});

test("检查器：好的瞬间通过；字太多、日子不对、缺文件、多文件都拦得住", () => {
  const dir = makeLibrary();
  const folder = join(dir, "first-bike");
  const check = (more) => checkMoment({ ...readLibrary(dir).moments[0], ...more }, folder).join("\n");
  try {
    assert.equal(check({}), "");

    writeFileSync(join(folder, "IMG_0001.MOV"), "原片");
    const problems = check({ title: "一个特别特别特别长的瞬间名字", when: { date: "2026-13-40" }, story: "Wrong Id" });
    assert.match(problems, /title：超过/);
    assert.match(problems, /YYYY-MM-DD/);
    assert.match(problems, /story/);
    assert.match(problems, /多出 IMG_0001\.MOV/);
    rmSync(join(folder, "IMG_0001.MOV"));

    assert.match(check({ when: { date: "2999-01-01" } }), /还没到/);
    assert.match(check({ blocks: [] }), /blocks 还是空的/);
    assert.match(check({ blocks: [{ text: "只有字" }] }), /至少要有一张照片或一段视频/);
    assert.match(check({ blocks: [{ photos: ["01.jpg"], said: "两样" }] }), /只能是 photos、video、text、said 里的一种/);
    assert.match(check({ blocks: [{ photos: ["01.jpg", "02.jpg", "03.jpg", "04.jpg"] }] }), /photos 放 1～3 张/);
    assert.match(check({ blocks: [{ photos: ["photo.jpg"] }] }), /不是照片的文件名/);
    assert.match(check({ blocks: [{ photos: ["01.jpg"] }, { video: "02.mp4" }] }), /找不到 02\.mp4，npm run moment:add/);
    assert.match(check({ blocks: [{ photos: ["01.jpg"] }, { video: "02.mp4" }] }), /找不到 02\.poster\.jpg/);
    assert.match(check({ blocks: [{ photos: ["01.jpg"] }, { said: "啊".repeat(41) }] }), /原话超过 40 个字/);
    assert.match(check({ blocks: [{ photos: ["01.jpg"] }, { text: "嗯", caption: "不该有" }] }), /caption 只跟在照片和视频后面/);
    assert.match(check({ cover: "02.jpg" }), /cover/);
    assert.equal(check({ cover: "01.jpg" }), "");

    writeFileSync(join(folder, "02.jpg"), JPEG);
    assert.match(check({}), /多出 02\.jpg/);
    assert.equal(check({ blocks: [{ photos: ["01.jpg", "02.jpg"], caption: "两张" }, { said: "我会骑了！" }] }), "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("library.json：名字、生日、年份卡的照片要对得上", () => {
  const dir = makeLibrary();
  try {
    const { moments } = readLibrary(dir);
    assert.deepEqual(checkProfile({ name: "小念", birthday: "2022-09-08", covers: { 2026: "first-bike/01.jpg" } }, dir, moments), []);
    assert.match(checkProfile({ name: "" }, dir, moments).join(), /name/);
    assert.match(checkProfile({ name: "小念", birthday: "2022-9-8" }, dir, moments).join(), /birthday/);
    assert.match(checkProfile({ name: "小念", covers: { 2025: "first-bike/01.jpg" } }, dir, moments).join(), /不是 2025 年的/);
    assert.match(checkProfile({ name: "小念", covers: { 2026: "first-bike/09.jpg" } }, dir, moments).join(), /瞬间id\/照片文件名/);
    assert.match(checkProfile({ name: "小念", covers: { 今年: "first-bike/01.jpg" } }, dir, moments).join(), /键写年份/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("视频拖进度条要的字节范围", () => {
  assert.deepEqual(byteRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(byteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange("bytes=90-999", 100), { start: 90, end: 99 });
  assert.equal(byteRange("bytes=100-", 100), "unsatisfiable");
  assert.equal(byteRange("bytes=20-10", 100), "unsatisfiable");
  for (const h of [undefined, "", "bytes=-", "bytes=0-1,4-5", "items=0-1"]) assert.equal(byteRange(h, 100), null);
});
