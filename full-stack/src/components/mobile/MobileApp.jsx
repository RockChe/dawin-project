"use client";
import { useState, useMemo, useCallback } from "react";
import { jumpToProject, backFromProject, switchTab } from "@/lib/mobileNav";
import { F } from "@/lib/theme";
import { toBusinessDateString } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { PermissionProvider } from "@/components/PermissionProvider";
import useTaskManager from "@/hooks/useTaskManager";
import useUserSettings from "@/hooks/useUserSettings";
import MobileTabBar from "./MobileTabBar";
import MoreScreen from "./MoreScreen";
import OverviewScreen from "./OverviewScreen";
import ProjectsScreen from "./ProjectsScreen";
import TimelineScreen from "./TimelineScreen";
import MyTasksScreen from "./MyTasksScreen";
import TaskSheet from "./TaskSheet";
import Breadcrumbs from "@/components/Breadcrumbs";
import { tabCrumbs } from "@/lib/breadcrumbs";
import { can } from "@/lib/permissions";

// 暫位畫面：後續 task 4–8 把真正的畫面換進 SCREENS（唯一替換點）。
function ScreenPlaceholder({ name, X }) {
  return <div style={{ padding: 16, color: X.textSec }}>{name}</div>;
}
const placeholder = name => function Screen({ X }) { return <ScreenPlaceholder name={name} X={X} />; };

const SCREENS = {
  mytasks: MyTasksScreen,
  overview: OverviewScreen,
  projects: ProjectsScreen,
  timeline: TimelineScreen,
};

export default function MobileApp({ initialData }) {
  const { X, PJC } = useTheme();
  const {
    projects, allS, twp, loading, userRole,
    toast, showToast, updateTask, toggleSub, addSub, configOwners,
  } = useTaskManager(initialData);
  const { settings: userSettings } = useUserSettings({}, showToast, initialData?.settings);
  // returnTab：從別的分頁（如時程）點進專案詳情時的來源，詳情的返回回到那裡（見 lib/mobileNav）
  const [nav, setNav] = useState({ tab: "mytasks", selectedProjectId: null, returnTab: null });
  const { tab, selectedProjectId, returnTab } = nav;
  const setTab = useCallback(t => setNav(n => switchTab(n, t)), []);
  const setSelectedProjectId = useCallback(id => setNav(n => ({ ...n, selectedProjectId: id })), []); // 專案清單點列；時程點列走 selectProject
  const selectProject = useCallback(id => setNav(n => jumpToProject(n, id)), []);
  const goBackFromProject = useCallback(() => setNav(backFromProject), []);
  const [sheetTaskId, setSheetTaskId] = useState(null); // TaskSheet 的開關；抽屜本身由 Task 7 渲染
  const openTask = useCallback(id => setSheetTaskId(id), []);
  const closeSheet = useCallback(() => setSheetTaskId(null), []);
  const goHome = useCallback(() => setTab("mytasks"), [setTab]); // 手機的「首頁」= 我的任務
  const sheetTask = sheetTaskId ? (twp || []).find(t => t.id === sheetTaskId) : null;

  const userName = initialData?.session?.name;
  const today = toBusinessDateString();
  const upcomingDays = userSettings.upcomingDays ?? 30;
  const upcomingLimit = userSettings.upcomingLimit ?? 5;
  const pcMap = useMemo(() => {
    const names = [...new Set([...(projects || []).map(p => p.name), ...(twp || []).map(d => d.project)])];
    const m = {};
    names.forEach((p, i) => { m[p] = PJC[i % PJC.length]; });
    return m;
  }, [projects, twp, PJC]);

  const Screen = SCREENS[tab];
  const screenProps = { twp, allS, projects, userName, userRole, today, X, openTask, updateTask, toggleSub, addSub, pcMap, configOwners, upcomingDays, upcomingLimit, selectedProjectId, setSelectedProjectId, returnTab, onBackFromProject: goBackFromProject, onSelectProject: selectProject, onHome: goHome };

  return (
    <PermissionProvider role={userRole}>
      <div className="mobile-app" style={{ minHeight: "100dvh", background: X.bg, fontFamily: F, color: X.text, paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        <style>{`*{box-sizing:border-box}`}</style>
        {/* 麵包屑：專案分頁由 ProjectsScreen 自己畫（詳情多一層），其餘分頁畫在畫面頂端 */}
        {!loading && tab !== "projects" && <div style={{ paddingTop: 4 }}><Breadcrumbs size="mobile" items={tabCrumbs(tab, { mobile: true, onHome: goHome })} /></div>}
        {loading ? <div style={{ padding: 16, color: X.textDim }}>載入中…</div>
          : tab === "more" ? <MoreScreen userName={userName} />
          : <Screen {...screenProps} />}
        {sheetTask && !loading && <TaskSheet key={sheetTask.id} task={sheetTask} subs={allS.filter(s => s.taskId === sheetTask.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))}
          configOwners={configOwners} canWrite={can(userRole, "write")} onClose={closeSheet} updateTask={updateTask} toggleSub={toggleSub} />}
        {toast && <div role="status" style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", left: 12, right: 12, zIndex: 60, background: X.surface, border: `1px solid ${X.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 14, color: X.text }}>{toast.msg}</div>}
        <MobileTabBar tab={tab} onChange={setTab} />
      </div>
    </PermissionProvider>
  );
}
