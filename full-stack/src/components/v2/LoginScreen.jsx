"use client";
import { useActionState, useEffect } from "react";
import { login } from "@/server/actions/auth";
import { useCloudLevel } from "@/components/CloudLevelContext";
import Cloud from "./Cloud";

// 設計稿「1 登入」：唯一五朵雲同框的畫面；雲朵關閉時退回品牌「P」圓形 Logo。
const FIVE = ["white", "pink", "purple", "dark", "nimbus"];

// 沿用既有 login action（回 redirectTo '/' 或 '/set-password'）；v2 內成功一律進 /v2，需改密碼才去 /set-password。
export const loginTarget = (redirectTo) => (redirectTo === "/set-password" ? "/set-password" : "/v2");

export default function LoginScreen({ action = login }) {
  const [state, formAction, isPending] = useActionState(action, null);
  const level = useCloudLevel();

  useEffect(() => {
    if (state?.success) window.location.assign(loginTarget(state.redirectTo));
  }, [state]);

  const busy = isPending || !!state?.success;
  return (
    <main className="login">
      <div className="five">
        {level === "off"
          ? <span className="bigp" aria-hidden="true">P</span>
          : FIVE.map((k, i) => <Cloud key={k} kind={k} size={112} motion="bob" delay={`${i * 0.25}s`} />)}
      </div>
      <div className="lh">
        <h1>大雲文創專案管理系統</h1>
        <p>歡迎回來，大雲的夥伴</p>
      </div>
      <form className="card lcard" action={formAction}>
        {state?.error && <div className="err" role="alert">{state.error}</div>}
        {state?.success && <div className="ok" role="status">登入成功，正在跳轉...</div>}
        <div>
          <label htmlFor="v2-email">Email</label>
          <input id="v2-email" className="fld" name="email" type="email" required autoComplete="username" placeholder="your@email.com" />
        </div>
        <div>
          <label htmlFor="v2-password">密碼</label>
          <input id="v2-password" className="fld" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button type="submit" className="btn lbtn" disabled={busy}>{isPending ? "登入中..." : state?.success ? "跳轉中..." : "登入"}</button>
        <div className="hint lhint">首次登入會請你先設定新密碼；忘記密碼請聯絡管理員。</div>
      </form>
    </main>
  );
}
