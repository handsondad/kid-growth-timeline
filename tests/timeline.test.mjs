import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, ageOn, byYear, COMPACT, layoutLine, LINE, neighbors, sagAt, sizeFor, yearAge } from "../src/pages/timeline.ts";

const fake = (id, date) => ({ id, title: id, about: "那天的事。", when: { date }, blocks: [] });
const days = (n, year = 2025) => Array.from({ length: n }, (_, i) => fake(`m${String(i).padStart(2, "0")}`, `${year}-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`));
const ids = (items) => items.map((it) => (it.kind === "moment" ? it.moment.id : `${it.kind}:${it.year}`));
const widthOf = (it, size = LINE) => (it.kind === "year" ? size.yearW : it.kind === "flag" ? size.flagW : size.tagW);
const last = (list) => list[list.length - 1];

const MOMENTS = [fake("c", "2026-04-22"), fake("a", "2025-06-01"), fake("b", "2025-12-31"), fake("z", "2023-02-01")];

test("默认每年收成一张年份卡，从早到晚；卡上带着那一年的瞬间", () => {
  const { items } = layoutLine(MOMENTS, null);
  assert.deepEqual(ids(items), ["year:2023", "year:2025", "year:2026"]);
  assert.deepEqual(items[1].moments.map((m) => m.id), ["a", "b"]);
});

test("点开一年：年份卡换成一面小旗，后面跟着那一年的瞬间，别的年还收着", () => {
  const { items, width } = layoutLine(MOMENTS, 2025);
  assert.deepEqual(ids(items), ["year:2023", "flag:2025", "a", "b", "year:2026"]);
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i].x - widthOf(items[i]) / 2 >= items[i - 1].x + widthOf(items[i - 1]) / 2 + LINE.gap - 0.01, "挂件不重叠");
  }
  assert.ok(items[0].x - widthOf(items[0]) / 2 >= LINE.pad - 0.01);
  assert.ok(last(items).x + widthOf(last(items)) / 2 <= width - LINE.pad + 0.01);
});

test("一年里瞬间多，绳子就比框长（左右滑），不换行", () => {
  const room = 1000;
  const { items, width } = layoutLine(days(30), 2025, room);
  assert.equal(items.length, 31);
  assert.ok(width > room);
  assert.equal(new Set(items.map((it) => Math.round(it.x))).size, items.length);
});

test("挂件少的时候绳子拉满一整个框，挂件居中、不撑得太开", () => {
  const { items, width } = layoutLine(MOMENTS, null, 1200);
  assert.equal(width, 1200);
  const left = items[0].x - widthOf(items[0]) / 2;
  const right = width - (last(items).x + widthOf(last(items)) / 2);
  assert.ok(Math.abs(left - right) < 0.01);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].x - items[i - 1].x <= LINE.yearW + LINE.gap + LINE.tagW / 2 + 0.01);
  assert.deepEqual(layoutLine([], null, 900), { items: [], width: 900 });
});

test("窄屏用小一号的挂件", () => {
  assert.equal(sizeFor(352), COMPACT);
  assert.equal(sizeFor(1000), LINE);
  assert.equal(sizeFor(0), LINE);
});

test("绳子两头高、中间最低", () => {
  const w = 1000;
  assert.equal(sagAt(LINE.pad / 2, w), 0);
  assert.ok(Math.abs(sagAt(w / 2, w) - LINE.sag) < 0.01);
  assert.ok(sagAt(w * 0.25, w) < sagAt(w / 2, w));
});

test("按年分组，组里从早到晚", () => {
  assert.deepEqual([...byYear(MOMENTS)].map(([y, list]) => [y, list.map((m) => m.id)]), [[2023, ["z"]], [2025, ["a", "b"]], [2026, ["c"]]]);
});

test("几岁了：年份卡上是那一年满几岁，详情里细到月", () => {
  assert.equal(yearAge("2022-09-08", 2022), "出生");
  assert.equal(yearAge("2022-09-08", 2025), "3 岁");
  assert.equal(yearAge("2022-09-08", 2021), null);
  assert.equal(ageOn("2022-09-08", "2022-09-08"), "出生那天");
  assert.equal(ageOn("2022-09-08", "2022-09-12"), "出生第 5 天");
  assert.equal(ageOn("2022-09-08", "2023-03-07"), "5 个月");
  assert.equal(ageOn("2022-09-08", "2023-09-08"), "1 岁");
  assert.equal(ageOn("2022-09-08", "2025-08-08"), "2 岁 11 个月");
  assert.equal(ageOn("2022-09-08", "2022-01-01"), null);
});

test("更早、后来按日子排，两头没有", () => {
  assert.equal(neighbors(MOMENTS, "b").prev?.id, "a");
  assert.equal(neighbors(MOMENTS, "b").next?.id, "c");
  assert.equal(neighbors(MOMENTS, "z").prev, undefined);
  assert.equal(neighbors(MOMENTS, "c").next, undefined);
});

test("离今天多久", () => {
  const today = new Date(2026, 10, 9);
  assert.equal(ago("2026-11-09", today), "就是今天");
  assert.equal(ago("2026-11-02", today), "7 天前");
  assert.equal(ago("2026-04-22", today), "6 个月前");
  assert.equal(ago("2025-06-01", today), "1 年零 5 个月前");
  assert.equal(ago("2024-11-09", today), "2 年前");
  assert.equal(ago("2026-12-01", today), "还没到那天");
});
