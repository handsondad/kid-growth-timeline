import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Library, SealedMoment } from "../moment/types.ts";
import { coverFile, mediaSummary } from "../moment/vocab.ts";
import { lock } from "../library.ts";
import { ago, ageOn, byYear, fullDate, layoutLine, monthDay, sizeFor, COMPACT, yearAge, yearOf } from "./timeline.ts";
import { VaultImg } from "./VaultMedia.tsx";

/** 拖过这么远才算拖动，不算点击 */
const DRAG = 5;

/** at：从详情页回来，打开它那一年并选中它；year：直接打开这一年 */
export function WallPage({ library, at, year }: { library: Library; at?: string; year?: number }) {
  const { moments, profile } = library;
  const scroller = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const size = sizeFor(room);

  const start = at ? moments.find((m) => m.id === at) : undefined;
  const [open, setOpen] = useState<number | null>(start ? yearOf(start) : year && byYear(moments).has(year) ? year : null);
  const [picked, setPicked] = useState<string | null>(start?.id ?? null);
  const { items, width } = useMemo(() => layoutLine(moments, open, room, size), [moments, open, room, size]);
  const shown = moments.find((m) => m.id === picked && yearOf(m) === open);
  const tags = items.flatMap((it) => (it.kind === "moment" ? [it.moment] : []));

  // 展开、收起之后把那一年挪到眼前；从详情页回来把那一张挪到中间
  const pending = useRef<{ id?: string; year?: number; smooth?: boolean } | null>(start ? { id: start.id } : open ? { year: open } : null);
  useLayoutEffect(() => {
    const el = scroller.current;
    const target = pending.current;
    if (!el || !target || !room) return;
    pending.current = null;
    const it = items.find((i) => (target.id ? i.kind === "moment" && i.moment.id === target.id : i.kind !== "moment" && i.year === target.year));
    if (!it) return;
    const left = target.id ? it.x - el.clientWidth / 2 : it.x - size.pad - (it.kind === "flag" ? size.flagW : size.yearW) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: target.smooth ? "smooth" : "auto" });
  }, [items, room, size]);

  const toggle = (y: number) => {
    setOpen((o) => (o === y ? null : y));
    setPicked(null);
    pending.current = { year: y, smooth: true };
  };

  // 左右滑：手指本来就能划；鼠标拖、竖着滚滚轮也能横着走；两头的箭头一次翻大半屏
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4 });
  }, []);
  useEffect(updateEdges, [items, room, updateEdges]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let drag: { x: number; left: number; moved: boolean } | null = null;
    let draggedAt = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 0) drag = { x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > DRAG) {
        drag.moved = true;
        el.classList.add("dragging");
      }
      if (drag.moved) el.scrollLeft = drag.left - dx;
    };
    const up = () => {
      if (drag?.moved) draggedAt = Date.now();
      drag = null;
      el.classList.remove("dragging");
    };
    // 拖完松手时浏览器会补一个点击，别让它点开年份
    const click = (e: MouseEvent) => {
      if (Date.now() - draggedAt < 80) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      // 滚到头了就让页面接着上下滚
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("click", click, true);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  const page = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.75, behavior: "smooth" });

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = tags.findIndex((m) => m.id === picked);
    const next = tags[i < 0 ? 0 : i + (e.key === "ArrowLeft" ? -1 : 1)];
    if (!next) return;
    e.preventDefault();
    setPicked(next.id);
    document.getElementById(`tag-${next.id}`)?.focus();
  };

  const age = (y: number) => (profile.birthday ? yearAge(profile.birthday, y) : null);
  const rope = `M ${size.pad / 2},${size.top} Q ${width / 2},${size.top + size.sag * 2} ${width - size.pad / 2},${size.top}`;

  return (
    <div className="app">
      <header className="hero">
        <h1>小念的成长时光轴</h1>
        <p>照片和小视频，按发生的日子夹在绳子上</p>
      </header>

      <section className={`line${size === COMPACT ? " compact" : ""}${edges.left ? " more-left" : ""}${edges.right ? " more-right" : ""}`} aria-label="成长时间绳">
        <div className="line-scroll" ref={scroller} onScroll={updateEdges}>
          <div className="line-track" style={{ width, height: size.rowH }}>
            <svg className="rope" width={width} height={size.top + size.sag + 20} aria-hidden="true">
              <path d={rope} />
            </svg>
            <span className="pole" style={{ left: size.pad / 2 - 9, height: size.rowH - 24 }} aria-hidden="true" />
            <span className="pole" style={{ left: width - size.pad / 2 - 9, height: size.rowH - 24 }} aria-hidden="true" />
            {!moments.length && <p className="line-empty">绳子上还空着，等第一张照片挂上来</p>}
            <div role="listbox" aria-label={open ? `${open} 年的瞬间，从早到晚` : "每一年"} aria-orientation="horizontal" onKeyDown={onKey}>
              {items.map((it) => {
                if (it.kind === "flag") {
                  return (
                    <button key={`f${it.year}`} className="year-flag" aria-expanded="true" aria-label={`收起 ${it.year} 年`}
                      style={{ left: it.x - size.flagW / 2, top: size.top + it.y - 4, width: size.flagW }} onClick={() => toggle(it.year)}>
                      <span className="flag-year">{it.year}</span>
                      {age(it.year) && <span className="flag-age">{age(it.year)}</span>}
                      <span className="flag-fold">收起</span>
                    </button>
                  );
                }
                if (it.kind === "year") {
                  const last = it.moments[it.moments.length - 1];
                  return (
                    <button key={`y${it.year}`} className="tag year-card" aria-expanded="false"
                      aria-label={`${it.year} 年${age(it.year) ? `，${age(it.year)}` : ""}，${it.moments.length} 个瞬间，点开看`}
                      style={{ left: it.x - size.yearW / 2, top: size.top + it.y - 10, width: size.yearW }} onClick={() => toggle(it.year)}>
                      <span className="peg" aria-hidden="true" />
                      <span className="card" style={{ background: it.color, ["--tilt" as string]: `${it.tilt}deg` }}>
                        <span className="thumb-wrap">
                          <VaultImg className="thumb" file={library.years[it.year] ?? last.thumb} alt="" eager />
                          {age(it.year) && <span className="age-badge">{age(it.year)}</span>}
                        </span>
                        <span className="day">{it.year}</span>
                        <span className="name">{it.moments.length} 个瞬间</span>
                      </span>
                    </button>
                  );
                }
                const m = it.moment;
                return (
                  <button key={m.id} id={`tag-${m.id}`} role="option" aria-selected={m.id === picked}
                    tabIndex={m.id === picked || (!shown && m === tags[0]) ? 0 : -1}
                    className={m.id === picked ? "tag on" : "tag"}
                    style={{ left: it.x - size.tagW / 2, top: size.top + it.y - 10, width: size.tagW }}
                    onFocus={() => setPicked(m.id)} onClick={() => setPicked(m.id)}>
                    <span className="peg" aria-hidden="true" />
                    <span className="card" style={{ background: it.color, ["--tilt" as string]: `${it.tilt}deg` }}>
                      <span className="thumb-wrap">
                        <VaultImg className="thumb" file={m.thumb} alt="" eager />
                        {m.blocks.some((b) => "video" in b) && <span className="play-badge" aria-label="有小视频">▶</span>}
                      </span>
                      <span className="day">{monthDay(m.when.date)}</span>
                      <span className="name">{m.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button className="edge left" hidden={!edges.left} onClick={() => page(-1)} aria-label="往前，更早的">‹</button>
        <button className="edge right" hidden={!edges.right} onClick={() => page(1)} aria-label="往后，后来的">›</button>
        {moments.length > 0 && <p className="line-hint">{open ? "左右滑一滑，看这一年 · 点一张看看 · 点小旗收起" : "点一个年份，看那一年"}</p>}
      </section>

      {shown && <Preview moment={shown} birthday={profile.birthday} />}

      <footer className="series">
        <p>同一个小念，还有画廊和漫画书</p>
        <div className="series-links">
          <a className="btn ghost" href="https://handsondad.github.io/kids-gallery/">🖼️ 小念的画廊</a>
          <a className="btn ghost" href="https://handsondad.github.io/storyverse/">📚 小念家的漫画书</a>
        </div>
        <button className="lock-btn" onClick={lock}>🔒 锁上</button>
      </footer>
    </div>
  );
}

function Preview({ moment, birthday }: { moment: SealedMoment; birthday?: string }) {
  const cover = coverFile(moment);
  const said = moment.blocks.find((b) => "said" in b);
  const age = birthday ? ageOn(birthday, moment.when.date) : null;
  return (
    <article className="preview" key={moment.id} aria-live="polite">
      <div className="preview-media">
        <VaultImg file={cover ? moment.files[cover] : undefined} alt={moment.title} eager />
      </div>
      <div className="preview-info">
        <p className="when">
          {fullDate(moment.when.date)}
          {moment.when.label && <span className="chip">{moment.when.label}</span>}
          {age && <span className="chip age">小念 {age}</span>}
          <span className="ago">{ago(moment.when.date, new Date())}</span>
        </p>
        <h2>{moment.title}</h2>
        <p>{moment.about}</p>
        {said && "said" in said && <blockquote className="said">「{said.said}」</blockquote>}
        <p className="by">{mediaSummary(moment)}</p>
        <a className="btn" href={`#/moment/${moment.id}`}>看详情</a>
      </div>
    </article>
  );
}
