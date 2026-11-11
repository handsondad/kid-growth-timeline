import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ID, readLibrary } from "../tools/library.mjs";
import { copyStarter, STARTER } from "../tools/starter.mjs";
import { checkMoment, checkProfile } from "./moment-rules.mjs";

test("起步节点：只有文字，没有照片视频和小念的原话；除了「还没有照片」都检查得过", () => {
  const lib = readLibrary(STARTER, { tracked: true });
  assert.equal(lib.problem, null);
  assert.deepEqual(lib.errors, []);
  assert.ok(lib.moments.length >= 10);
  assert.deepEqual(checkProfile(lib.profile, STARTER, lib.moments), []);
  for (const m of lib.moments) {
    assert.match(m.id, ID);
    assert.deepEqual(readdirSync(join(STARTER, m.id)).sort(), ["moment.json", "notes.md"], `${m.id} 里只放文字`);
    assert.ok(m.blocks.every((b) => Object.keys(b).join() === "text"), `${m.id} 的 blocks 只有文字`);
    const problems = checkMoment(m, join(STARTER, m.id));
    assert.deepEqual(problems.filter((p) => !/至少要有一张照片或一段视频/.test(p)), [], m.id);
  }
});

test("npm run starter：复制进 albums/；已经有的、改过的不动", () => {
  const library = mkdtempSync(join(tmpdir(), "kid-growth-albums-"));
  try {
    const first = copyStarter({ library });
    const ids = readLibrary(STARTER, { tracked: true }).moments.map((m) => m.id).sort();
    assert.deepEqual(first.copied.sort(), ids);
    assert.deepEqual(readFileSync(join(library, "zoo", "moment.json")), readFileSync(join(STARTER, "zoo", "moment.json")));
    assert.deepEqual(JSON.parse(readFileSync(join(library, "profile.json"), "utf8")), JSON.parse(readFileSync(join(STARTER, "profile.json"), "utf8")));

    writeFileSync(join(library, "zoo", "moment.json"), JSON.stringify({ title: "改过了" }));
    writeFileSync(join(library, "profile.json"), JSON.stringify({ name: "小念", birthday: "2024-03-15" }));
    rmSync(join(library, "hello"), { recursive: true });
    const again = copyStarter({ library });
    assert.deepEqual(again.copied, ["hello"]);
    assert.equal(JSON.parse(readFileSync(join(library, "zoo", "moment.json"), "utf8")).title, "改过了");
    assert.equal(JSON.parse(readFileSync(join(library, "profile.json"), "utf8")).birthday, "2024-03-15");
  } finally {
    rmSync(library, { recursive: true, force: true });
  }
});
