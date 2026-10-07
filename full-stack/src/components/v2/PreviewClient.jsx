"use client";
import { useLayoutEffect } from "react";
import { PermissionProvider } from "@/components/PermissionProvider";
import { CloudLevelProvider } from "@/components/CloudLevelContext";
import Shell from "./Shell";
import LoginScreen from "./LoginScreen";
import StatesGallery from "./StatesGallery";
import { StaticSettingsProvider } from "./SettingsContext";
import { fixtureShellProps, FIXTURE_OWNERS, FIXTURE_SUBTASKS } from "./fixtures";

// 開發預覽（僅 NODE_ENV!=='production' 由 page 放行）：假資料、設定唯讀（no-op）、不碰 server action／DB。
// ?theme=dark|light 供截圖：子元件的 layout effect 比 ThemeProvider 先跑，先寫好它讀的 localStorage key，
// 主題仍由 ThemeProvider 單一來源決定（它的 hydration 策略不變）。
// 預覽的登入表單不送出任何東西（不建 session、不打 DB）
const previewLogin = async () => ({ error: "預覽模式：不會真的登入" });

// view／arch：Projects 預覽用（明細視圖、封存區展開）；Projects 預覽固定把 p3 設為「不在 Timeline 顯示」以看眼睛的兩種狀態
// tl：Timeline 預覽用（view＝gantt|card、expanded＝任務列全展開、scale＝日週月季）；預覽固定隱藏 p3 以外的專案都顯示（封存的 p10 本來就不畫）
// pj：專案詳情預覽用（id＝開哪個專案、empty＝拿掉該專案的任務看空狀態、expanded＝展開子任務的任務 id、alldone＝把某任務的子任務全勾完以顯示「可以改成已完成了」）
// tm：任務視窗預覽用（mode＝new|edit、tid＝編輯哪個任務、pid＝新增時預填的專案、role＝viewer 看唯讀）；底下墊著專案詳情，handlers 全是無副作用的 no-op
const NOOP = () => {};
const OK = async () => ({ success: true });
const PREVIEW_MODAL = {
  addTask: OK, updateTask: OK, allS: FIXTURE_SUBTASKS, addSub: OK, deleteSub: NOOP, toggleSub: NOOP, updateSub: NOOP, reorderSubs: NOOP,
  configCats: ["商務合作", "活動", "播出/開始", "行銷", "發行", "市場展"], configOwners: FIXTURE_OWNERS,
  allL: [{ id: "l1", taskId: "t1", url: "https://www.kktix.com/events/duoer", title: "KKTIX 售票頁" }],
  allF: [{ id: "f1", taskId: "t1", name: "場租合約-v2.pdf", size: 482113, r2Key: "preview/none" }],
  addLink: OK, addFile: NOOP, deleteLink: NOOP, deleteFile: NOOP, showToast: NOOP,
};
// st：Settings 預覽用（sub＝cloud 直接開「雲朵」專區、motion＝off 看動態關閉、cats＝分類）；Data／Settings 預覽可用 role=viewer 看唯讀
export default function PreviewClient({ screen, theme, clouds, view = 'card', arch = false, tl = {}, pj = {}, tm = {}, st = {}, q = "" }) {
  const shellTab = screen === "shell" ? "overview" : screen === "project" || screen === "taskmodal" ? "projects" : screen;
  const props = fixtureShellProps();
  if (screen === "project") {
    if (pj.empty) props.tasks = props.tasks.filter((t) => t.projectId !== pj.id);
    if (pj.alldone) props.subtasks = props.subtasks.map((s) => (s.taskId === pj.alldone ? { ...s, done: true } : s));
  }
  useLayoutEffect(() => {
    if (!theme) return;
    try { localStorage.setItem("dash-theme", theme === "dark" ? "dimmed" : "warm"); } catch {}
  }, [theme]);

  return (
    <PermissionProvider role={tm.role === "viewer" || st.role === "viewer" ? "viewer" : "admin"}>
      <StaticSettingsProvider settings={{ cloudLevel: clouds, projectsView: view, hiddenProjects: screen === 'projects' ? ['p3'] : [], timelineView: tl.view, timelineDefaultCollapsed: !tl.expanded, ...(tl.scale ? { timeDimTimeline: tl.scale } : null), ...(st.motion === 'off' ? { cloudMotion: false } : null) }}>
        {screen === "states" && <StatesGallery />}
        {(screen === "shell" || screen === "overview" || screen === "mytasks" || screen === "projects" || screen === "timeline" || screen === "project" || screen === "taskmodal" || screen === "data" || screen === "settings") && <Shell {...props} searchInit={q} initialTab={shellTab} projectsInit={{ showArch: arch }} timelineInit={{ filterOpen: tl.fo, selectedId: tl.sel }}
          settingsInit={{ sub: st.sub, csel: st.csel }} config={{ cats: PREVIEW_MODAL.configCats, owners: FIXTURE_OWNERS }}
          detailInit={screen === "project" ? { projectId: pj.id, expanded: pj.expanded } : screen === "taskmodal" ? { projectId: tm.pid || "p1" } : undefined}
          taskModal={screen === "taskmodal" ? PREVIEW_MODAL : undefined}
          modalInit={screen === "taskmodal" ? (tm.mode === "new" ? { projectId: tm.pid || "p1" } : { taskId: tm.tid || "t1" }) : undefined} />}
        {screen === "login" && <CloudLevelProvider level={clouds}><LoginScreen action={previewLogin} /></CloudLevelProvider>}
      </StaticSettingsProvider>
    </PermissionProvider>
  );
}
