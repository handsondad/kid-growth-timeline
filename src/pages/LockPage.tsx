import { useState, type FormEvent } from "react";
import type { Library } from "../moment/types.ts";
import { unlock } from "../library.ts";
import { WrongPassword, type KeyFile } from "../vault/crypto.ts";

/** 照片和视频都是加密的：输对密码，在这台设备上解开 */
export function LockPage({ keyFile, onOpen }: { keyFile: KeyFile; onOpen: (library: Library) => void }) {
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      onOpen(await unlock(keyFile, password, remember));
    } catch (err) {
      setError(err instanceof WrongPassword ? "密码不对，再试一次" : (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="app lock">
      <form className="lock-card" onSubmit={submit}>
        <span className="lock-icon" aria-hidden="true">🔒</span>
        <h1>小念的成长时光轴</h1>
        <p>照片和视频都锁起来了，输入密码才能看</p>
        <input className="lock-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="密码" aria-label="密码" autoComplete="current-password" autoFocus />
        <label className="remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          这台设备记住我（别人的手机、电脑别勾）
        </label>
        <button className="btn" disabled={busy || !password}>{busy ? "正在解锁…" : "打开"}</button>
        {error && <p className="lock-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
