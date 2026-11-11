import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import type { Block, FileRef, Library, SealedMoment } from "../moment/types.ts";
import { mediaSummary, posterOf } from "../moment/vocab.ts";
import { storyUrl, workUrl } from "../library.ts";
import { ago, ageOn, fullDate, neighbors } from "./timeline.ts";
import { VaultImg, VaultVideo } from "./VaultMedia.tsx";

/** 手指横着划过这么远才算翻页，免得上下滚动时误翻 */
const SWIPE = 60;

/** 播放器自己要用方向键和拖动来快进，别抢 */
const inPlayer = (target: EventTarget | null) => target instanceof HTMLVideoElement;

type Photo = { readonly name: string; readonly caption?: string };

/** 一个图集的详情：一组照片、视频和文字从上往下排；点照片看大图，← → 换前后一个图集 */
export function MomentPage({ moment, library }: { moment: SealedMoment; library: Library }) {
  const { prev, next } = neighbors(library.moments, moment.id);
  const prevHref = prev ? `#/moment/${prev.id}` : null;
  const nextHref = next ? `#/moment/${next.id}` : null;
  const back = `#/at/${moment.id}`;
  const photos: Photo[] = moment.blocks.flatMap((b) => ("photos" in b ? b.photos.map((name) => ({ name, caption: b.caption })) : []));
  const [viewing, setViewing] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const age = library.profile.birthday ? ageOn(library.profile.birthday, moment.when.date) : null;

  const step = (dir: -1 | 1) => {
    if (viewing !== null) setViewing((v) => (v === null ? v : Math.min(photos.length - 1, Math.max(0, v + dir))));
    else if (dir < 0 && prevHref) location.hash = prevHref;
    else if (dir > 0 && nextHref) location.hash = nextHref;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || inPlayer(e.target)) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Escape") {
        if (viewing !== null) setViewing(null);
        else location.hash = back;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    document.body.style.overflow = viewing === null ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [viewing]);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = e.touches.length === 1 && !inPlayer(e.target) ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  };

  const open = (name: string) => setViewing(photos.findIndex((p) => p.name === name));

  return (
    <div className="app" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="topbar">
        <a className="btn ghost" href={back}>← 时光轴</a>
        <span className="meta">{mediaSummary(moment)}</span>
      </div>

      <article className="story" key={moment.id}>
        <header className="story-head">
          <p className="when">
            {fullDate(moment.when.date)}
            {moment.when.label && <span className="chip">{moment.when.label}</span>}
            {age && <span className="chip age">小念 {age}</span>}
            <span className="ago">{ago(moment.when.date, new Date())}</span>
          </p>
          <h1>{moment.title}</h1>
          <p className="story-about">{moment.about}</p>
        </header>

        {moment.blocks.map((b, i) => <BlockView key={i} block={b} moment={moment} name={library.profile.name} onOpen={open} />)}

        {(moment.story || moment.work) && (
          <div className="links">
            {moment.work && <a className="btn ghost" href={workUrl(moment.work)}>🖼️ 那天的作品，在画廊里</a>}
            {moment.story && <a className="btn ghost" href={storyUrl(moment.story)}>📚 那天的故事，在漫画书里</a>}
          </div>
        )}
      </article>

      <div className="pager">
        {prevHref ? <a className="btn ghost" href={prevHref}>更早</a> : <button className="btn ghost" disabled>更早</button>}
        {nextHref ? <a className="btn" href={nextHref}>后来</a> : <a className="btn" href={back}>回时光轴</a>}
      </div>
      <p className="hint">点照片看大图 · ← → 或左右滑动换一个图集 · Esc 回时光轴</p>

      {viewing !== null && photos[viewing] && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="看大图" onClick={(e) => { if (e.target === e.currentTarget) setViewing(null); }}>
          <VaultImg key={photos[viewing].name} file={moment.files[photos[viewing].name]} alt={photos[viewing].caption ?? moment.title} eager />
          <p className="lightbox-caption">{photos[viewing].caption}<span>{viewing + 1} / {photos.length}</span></p>
          <button className="lightbox-btn close" onClick={() => setViewing(null)} aria-label="关上">×</button>
          {viewing > 0 && <button className="lightbox-btn prev" onClick={() => step(-1)} aria-label="上一张">‹</button>}
          {viewing < photos.length - 1 && <button className="lightbox-btn next" onClick={() => step(1)} aria-label="下一张">›</button>}
        </div>
      )}
    </div>
  );
}

/** 一张竖着的照片别撑满整行：按比例收窄，让它的高不超过一屏 */
function single(file: FileRef | undefined, count: number): CSSProperties | undefined {
  if (count !== 1 || !file?.w || !file?.h) return undefined;
  return { maxWidth: `calc(min(80vh, 720px) * ${(file.w / file.h).toFixed(4)} + 20px)` };
}

function BlockView({ block, moment, name, onOpen }: { block: Block; moment: SealedMoment; name: string; onOpen: (photo: string) => void }) {
  if ("photos" in block) {
    return (
      <figure className={`story-photos n${block.photos.length}`}>
        <div className="photo-row">
          {block.photos.map((p) => (
            <button key={p} className="photo-open" onClick={() => onOpen(p)} aria-label="看大图" style={single(moment.files[p], block.photos.length)}>
              <VaultImg file={moment.files[p]} alt={block.caption ?? moment.title} />
            </button>
          ))}
        </div>
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
  }
  if ("video" in block) {
    return (
      <figure className="story-video">
        <div className="video-frame">
          <VaultVideo video={moment.files[block.video]} poster={moment.files[posterOf(block.video)]} label={block.caption ?? moment.title} />
        </div>
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
  }
  if ("said" in block) return <blockquote className="said story-said">「{block.said}」<cite>—— {name}</cite></blockquote>;
  return <p className="story-text">{block.text}</p>;
}
