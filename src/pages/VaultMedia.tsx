import { useEffect, useRef, useState } from "react";
import type { FileRef } from "../moment/types.ts";
import { fileUrl } from "../library.ts";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** 加密的照片：滚到跟前才下载、解开；解开之前是一块同样大小的底色 */
export function VaultImg({ file, alt, className = "", eager = false }: { file?: FileRef; alt: string; className?: string; eager?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!file) return;
    let alive = true;
    const load = () => fileUrl(file).then((u) => alive && setUrl(u), () => alive && setFailed(true));
    const el = ref.current;
    if (eager || !el || !("IntersectionObserver" in window)) {
      load();
      return () => { alive = false; };
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      load();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [file?.blob, eager]);
  const state = failed ? " img-failed" : url ? "" : " img-wait";
  return (
    <img ref={ref} src={url ?? BLANK} alt={alt} className={className + state} draggable={false}
      width={file?.w} height={file?.h} style={file?.w && file?.h ? { aspectRatio: `${file.w} / ${file.h}` } : undefined} />
  );
}

type Step = { step: "idle" } | { step: "loading"; done: number } | { step: "ready"; url: string } | { step: "failed"; message: string };

/** 加密的小视频：先只显示封面，点了才下载、解开（显示进度），解开后在页面里播 */
export function VaultVideo({ video, poster, label }: { video?: FileRef; poster?: FileRef; label: string }) {
  const [state, setState] = useState<Step>({ step: "idle" });
  const [posterUrl, setPosterUrl] = useState<string>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (poster) fileUrl(poster).then(setPosterUrl, () => {});
  }, [poster?.blob]);
  useEffect(() => () => { if (state.step === "ready") URL.revokeObjectURL(state.url); }, [state]);

  const start = () => {
    if (!video || state.step === "loading") return;
    setState({ step: "loading", done: 0 });
    fileUrl(video, (done) => alive.current && setState({ step: "loading", done })).then(
      (url) => (alive.current ? setState({ step: "ready", url }) : URL.revokeObjectURL(url)),
      (err: Error) => alive.current && setState({ step: "failed", message: err.message }),
    );
  };

  if (state.step === "ready") {
    return <video src={state.url} poster={posterUrl} controls autoPlay playsInline aria-label={label} />;
  }
  return (
    <button className="video-start" onClick={start} aria-label={`播放：${label}`} aria-busy={state.step === "loading"}>
      <VaultImg file={poster} alt="" className="video-poster" eager />
      <span className="play-big" aria-hidden="true">{state.step === "loading" ? `${Math.round(state.done * 100)}%` : "▶"}</span>
      {state.step === "loading" && <span className="video-note">正在解密…</span>}
      {state.step === "failed" && <span className="video-note">{state.message}，点一下再试</span>}
    </button>
  );
}
