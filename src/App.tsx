import { useEffect, useState } from "react";
import type { Library } from "./moment/types.ts";
import { fetchKeyFile, resume } from "./library.ts";
import type { KeyFile } from "./vault/crypto.ts";
import { LockPage } from "./pages/LockPage.tsx";
import { MomentPage } from "./pages/MomentPage.tsx";
import { WallPage } from "./pages/WallPage.tsx";

/** #/moment/<id> 看一个瞬间；#/at/<id> 回首页停在它那里；#/year/<年> 打开那一年 */
function route(hash: string): { page: string; param?: string } {
  const [, page = "", param] = hash.replace(/^#/, "").split("/");
  return { page, param: param ? decodeURIComponent(param) : undefined };
}

type State =
  | { readonly step: "loading" }
  | { readonly step: "empty" }
  | { readonly step: "locked"; readonly keyFile: KeyFile }
  | { readonly step: "open"; readonly library: Library }
  | { readonly step: "failed"; readonly message: string };

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [state, setState] = useState<State>({ step: "loading" });

  useEffect(() => {
    fetchKeyFile()
      .then(async (keyFile) => {
        if (!keyFile) return setState({ step: "empty" });
        const library = await resume(keyFile);
        setState(library ? { step: "open", library } : { step: "locked", keyFile });
      })
      .catch((err: Error) => setState({ step: "failed", message: err.message }));
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [hash]);

  if (state.step === "loading") return <div className="app"><p className="loading">正在打开时光库…</p></div>;
  if (state.step === "failed") return <div className="app"><p className="loading">{state.message}</p></div>;
  if (state.step === "empty") return <div className="app"><p className="loading">还没有加密好的时光库：npm run seal -- --init</p></div>;
  if (state.step === "locked") return <LockPage keyFile={state.keyFile} onOpen={(library) => setState({ step: "open", library })} />;

  const { library } = state;
  const { page, param } = route(hash);
  const moment = page === "moment" ? library.moments.find((m) => m.id === param) : undefined;
  if (moment) return <MomentPage moment={moment} library={library} />;
  return <WallPage key={hash} library={library} at={page === "at" ? param : undefined} year={page === "year" ? Number(param) : undefined} />;
}
