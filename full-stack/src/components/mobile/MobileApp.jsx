"use client";
import { useState, useMemo, useCallback } from "react";
import { F } from "@/lib/theme";
import { toBusinessDateString } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { PermissionProvider } from "@/components/PermissionProvider";
import useTaskManager from "@/hooks/useTaskManager";
import useUserSettings from "@/hooks/useUserSettings";
import MobileTabBar from "./MobileTabBar";
import MoreScreen from "./MoreScreen";
import OverviewScreen from "./OverviewScreen";
import TaskSheet from "./TaskSheet";
import { can } from "@/lib/permissions";

// 暫位畫面：後續 task 4–8 把真正的畫面換進 SCREENS（唯一替換點）。
function ScreenPlaceholder({ name, X }) {
  return <div style={{ padding: 16, color: X.textSec }}>{name}</div>;
}
const placeholder = name => function Screen({ X }) { return <ScreenPlaceholder name={name} X={X} />; };

const SCREENS = {
  mytasks: placeholder("我的任務"),
  overview: OverviewScreen,
  projects: placeholder("專案"),
  timeline: placeholder("時程"),
};

export default function MobileApp({ initialData }) {
  const { X, PJC } = useTheme();
  const {
    projects, allS, twp, loading, userRole,
    toast, showToast, updateTask, toggleSub, addSub, configOwners,
  } = useTaskManager(initialData);
  const { settings: userSettings } = useUserSettings({}, showToast, initialData?.settings);
  const [tab, setTab] = useState("mytasks");
  const [sheetTaskId, setSheetTaskId] = useState(null); // TaskSheet 的開關；抽屜本身由 Task 7 渲染
  const openTask = useCallback(id => setSheetTaskId(id), []);
  const closeSheet = useCallback(() => setSheetTaskId(null), []);
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
  const screenProps = { twp, allS, projects, userName, userRole, today, X, openTask, updateTask, toggleSub, addSub, pcMap, configOwners, upcomingDays, upcomingLimit };

  return (
    <PermissionProvider role={userRole}>
      <div style={{ minHeight: "100dvh", background: X.bg, fontFamily: F, color: X.text, paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        <style>{`*{box-sizing:border-box}`}</style>
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
