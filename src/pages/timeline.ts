/**
 * 首页的时间绳：默认每一年收成一张年份卡（照片 + 那年几岁），点开一年，那一年的瞬间按日子从左往右夹在绳子上，
 * 年份卡变成开头的一面小旗。绳子是一条二次贝塞尔曲线，两头高、中间垂下去；挂件的高度跟着绳子走。
 * 绳子比屏幕长就左右滑（滚动条藏起来）。和《小念家的漫画书》《小念的画廊》首页是同一根绳子。
 */
import type { Moment } from "../moment/types.ts";

export type LineSize = {
  readonly tagW: number;
  /** 收起来的年份卡 */
  readonly yearW: number;
  /** 展开那一年开头的小旗 */
  readonly flagW: number;
  readonly gap: number;
  /** 两头留给立杆 */
  readonly pad: number;
  /** 绳子中间垂下多少 */
  readonly sag: number;
  /** 绳子两头的高度 */
  readonly top: number;
  /** 绳子连同挂件占多高 */
  readonly rowH: number;
};

export const LINE: LineSize = { tagW: 150, yearW: 160, flagW: 84, gap: 26, pad: 64, sag: 36, top: 28, rowH: 304 };
/** 手机上挂件小一号 */
export const COMPACT: LineSize = { tagW: 124, yearW: 132, flagW: 72, gap: 14, pad: 40, sag: 24, top: 24, rowH: 266 };
export const sizeFor = (room: number): LineSize => (room > 0 && room < 560 ? COMPACT : LINE);

export type LineItem<M extends Moment = Moment> =
  | { readonly kind: "year"; readonly year: number; readonly moments: readonly M[]; readonly x: number; readonly y: number; readonly tilt: number; readonly color: string }
  | { readonly kind: "flag"; readonly year: number; readonly x: number; readonly y: number }
  | { readonly kind: "moment"; readonly moment: M; readonly x: number; readonly y: number; readonly tilt: number; readonly color: string };

const TILTS = [-3, 2.5, -1.5, 3, -2.5, 1.5];
const COLORS = ["#ffe3c2", "#d9ecff", "#dff5e8", "#ffe0ea", "#efe4ff", "#fff2b8"];

export const byDate = (a: Moment, b: Moment) => a.when.date.localeCompare(b.when.date) || a.id.localeCompare(b.id);
export const yearOf = (m: Moment) => Number(m.when.date.slice(0, 4));

/** 绳子在横坐标 x 处垂下多少（0 是两头的高度） */
export function sagAt(x: number, width: number, size: LineSize = LINE): number {
  const t = Math.min(1, Math.max(0, (x - size.pad / 2) / (width - size.pad)));
  return 4 * size.sag * t * (1 - t);
}

/** 每一年的瞬间，从早到晚 */
export function byYear<M extends Moment>(moments: readonly M[]): Map<number, M[]> {
  const years = new Map<number, M[]>();
  for (const m of [...moments].sort(byDate)) years.set(yearOf(m), [...(years.get(yearOf(m)) ?? []), m]);
  return years;
}

/**
 * open：展开哪一年（null 是全收着）；room：框有多宽，绳子至少拉这么长。
 * 挂件少的时候不硬撑开，居中挂着。
 */
export function layoutLine<M extends Moment>(moments: readonly M[], open: number | null, room = 0, size: LineSize = LINE): { items: LineItem<M>[]; width: number } {
  type Slot = { kind: "year"; year: number; moments: M[] } | { kind: "flag"; year: number } | { kind: "moment"; moment: M };
  const slots: Slot[] = [];
  for (const [year, list] of byYear(moments)) {
    if (year === open) slots.push({ kind: "flag", year }, ...list.map((moment) => ({ kind: "moment" as const, moment })));
    else slots.push({ kind: "year", year, moments: list });
  }
  const widthOf = (s: Slot) => (s.kind === "year" ? size.yearW : s.kind === "flag" ? size.flagW : size.tagW);
  const content = slots.reduce((sum, s) => sum + widthOf(s), 0) + size.gap * Math.max(0, slots.length - 1);
  const width = Math.max(room, content + size.pad * 2);
  const free = width - size.pad * 2 - content;
  const extra = Math.min(free / (slots.length + 1), size.tagW / 2);

  let left = size.pad + (free - extra * Math.max(0, slots.length - 1)) / 2;
  let n = 0;
  const items = slots.map((s): LineItem<M> => {
    const x = left + widthOf(s) / 2;
    left += widthOf(s) + size.gap + extra;
    const y = sagAt(x, width, size);
    if (s.kind === "flag") return { kind: "flag", year: s.year, x, y };
    const i = n++;
    const look = { x, y, tilt: TILTS[i % TILTS.length], color: COLORS[i % COLORS.length] };
    return s.kind === "year" ? { kind: "year", year: s.year, moments: s.moments, ...look } : { kind: "moment", moment: s.moment, ...look };
  });
  return { items, width };
}

/** 上一个、下一个：按时间绳上的顺序 */
export function neighbors<M extends Moment>(moments: readonly M[], id: string): { prev?: M; next?: M } {
  const sorted = [...moments].sort(byDate);
  const i = sorted.findIndex((m) => m.id === id);
  if (i < 0) return {};
  return { prev: sorted[i - 1], next: sorted[i + 1] };
}

/** 「2025年6月1日」 */
export function fullDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 「6月1日」 */
export function monthDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日`;
}

/** 那天几岁：「出生那天」「出生第 5 天」「8 个月」「3 岁」「3 岁 2 个月」；生日之前返回 null */
export function ageOn(birthday: string, date: string): string | null {
  const [by, bm, bd] = birthday.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  const days = (Date.UTC(y, m - 1, d) - Date.UTC(by, bm - 1, bd)) / 86400000;
  if (days < 0) return null;
  let months = (y - by) * 12 + (m - bm);
  if (d < bd) months -= 1;
  if (months < 1) return days === 0 ? "出生那天" : `出生第 ${days + 1} 天`;
  if (months < 12) return `${months} 个月`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} 岁 ${rest} 个月` : `${years} 岁`;
}

/** 年份卡上的：这一年过生日满几岁；出生那年是「出生」 */
export function yearAge(birthday: string, year: number): string | null {
  const n = year - Number(birthday.slice(0, 4));
  if (n < 0) return null;
  return n === 0 ? "出生" : `${n} 岁`;
}

/** 离今天多久：「今天」「3 天前」「5 个月前」「1 年零 5 个月前」 */
export function ago(date: string, today: Date): string {
  const [y, m, d] = date.split("-").map(Number);
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d)) / 86400000);
  if (days < 0) return "还没到那天";
  if (days === 0) return "就是今天";
  if (days < 31) return `${days} 天前`;
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() - (m - 1));
  if (today.getDate() < d) months -= 1;
  months = Math.max(1, months);
  if (months < 12) return `${months} 个月前`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} 年零 ${rest} 个月前` : `${years} 年前`;
}
