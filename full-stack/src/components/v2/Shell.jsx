"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudLevelProvider } from "@/components/CloudLevelContext";
import { useCan } from "@/components/PermissionProvider";
import { overallProgress } from "@/lib/v2Overall";
import { buildTwp } from "@/lib/v2Data";
import { filterBySearch } from "@/lib/v2Search";
import Header from "./Header";
import Tabs, { TAB_LABEL } from "./Tabs";
import Breadcrumb from "./Breadcrumb";
import Overview from "./Overview";
import MyTasks from "./MyTasks";
import Projects from "./Projects";
import Timeline from "./Timeline";
import ProjectDetail from "./ProjectDetail";
import Data from "./Data";
import Settings from "./Settings";
import TaskModalHost from "./TaskModalHost";
import { useV2Settings } from "./SettingsContext";

// v2 外殼：頁首＋分頁列＋麵包屑。各分頁內容在後續 Wave 逐頁接上，未接的先顯示佔位。
// today 由 server page 取一次（營業日快照）傳下，內容區共用；twp（任務＋進度）在這裡算一次給各分頁。
// onOpenTask：點任務時的額外回呼（可選）。任務視窗由 Shell 自己持有：給了 taskModal（TaskModal 需要的資料與處理函式）才會開，
//   點任務＝onOpenTask(task)、「+ Create」＝onOpenTask(null, { projectId })；關閉後焦點回到觸發元素；沒有 write 權限不開「新增」。
// searchInit：預覽用，搜尋框一開始就有字（已套用）。
// modalInit：預覽用，{ taskId } 或 { projectId } 讓任務視窗一開始就開著。
// 頁首搜尋：Shell 持有字串（輸入即時、300ms debounce 後才過濾），分頁各自套用 filterBySearch（規則見 lib/v2Search）。
// projectActions：Projects／專案詳情的寫入動作 { archive, unarchive, remove, add, reorder, updateTask, deleteTask, toggleSub, addSub, deleteSub, reorderTasks, notify, rename, uploadBanner, removeBanner }
//   （Live 版接 useTaskManager；沒給的動作預設 no-op，預覽就是這樣）。
// projectsInit：預覽用，{ showArch } 讓封存區一開始就展開。
// timelineInit：預覽用，{ filterOpen, selectedId } 讓 Timeline 篩選 popover／詳情條一開始就出現。
// detailInit：預覽用，{ projectId, expanded } 一開始就開啟某專案詳情、並展開指定任務的子任務。
// dataActions：Data／Settings 的寫入動作 { updateTask, updateSub, deleteTask, deleteSub, toggleSub, addTask, addSub, importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks, saveCats, notify }
//   （Live 版接 useTaskManager；沒給的預設 no-op，預覽就是這樣）。config：{ cats, owners }（分類與 Users 表名單）。
// settingsInit：預覽用，{ sub } 讓 Settings 一開始就在「雲朵」專區（?set=cloud）。
const NO_DATA = {
  updateTask() {}, updateSub() {}, deleteTask() {}, deleteSub() {}, toggleSub() {}, importTasks() {}, deleteManyTasks() {}, updateManyTasks() {}, deleteAllTasks() {}, saveCats() {}, notify() {},
  addTask: async () => ({ error: "預覽模式" }), addSub: async () => ({ error: "預覽模式" }),
};
const NO_ACTIONS = {
  archive() {}, unarchive() {}, remove() {}, add: async () => ({ error: "預覽模式" }), reorder() {},
  updateTask() {}, deleteTask() {}, toggleSub() {}, addSub: async () => ({ error: "預覽模式" }), deleteSub() {}, reorderTasks() {}, notify() {},
  rename() {}, uploadBanner() {}, removeBanner() {},
};
const SEARCH_DEBOUNCE = 300;
export default function Shell({ tasks, subtasks, projects = [], userName, userNames = [], today, initialTab = "overview", onOpenTask, taskModal, modalInit, searchInit = "", projectActions, projectsInit, timelineInit, detailInit, dataActions, config, settingsInit }) {
  const { settings, updateSetting } = useV2Settings();
  const canWrite = useCan("write");
  const [tab, setTab] = useState(initialTab);
  const [setSub, setSetSub] = useState(settingsInit?.sub === "cloud" ? "cloud" : "general"); // Settings 左側子選單
  const dActions = useMemo(() => ({ ...NO_DATA, ...dataActions }), [dataActions]);
  const cfg = useMemo(() => config || { cats: [], owners: userNames }, [config, userNames]);
  const [projId, setProjId] = useState(detailInit?.projectId || null); // 開啟中的專案（詳情）；返回／換分頁就清掉
  const [focus, setFocus] = useState(null); // Overview 播報列點進 My Tasks 的目標分組（n 遞增，重複點同一組也會重觸發）
  const go = (t) => { setFocus(null); setProjId(null); if (t === "settings") setSetSub("general"); setTab(t); }; // 手動換分頁就清掉跳轉目標；點 Settings（分頁或麵包屑）回到「一般」
  const actions = useMemo(() => ({ ...NO_ACTIONS, ...projectActions }), [projectActions]);
  const overall = useMemo(() => overallProgress(tasks, subtasks, today), [tasks, subtasks, today]);
  const twp = useMemo(() => buildTwp(tasks, subtasks, projects, today), [tasks, subtasks, projects, today]);
  const proj = projId ? projects.find((p) => p.id === projId) : null;

  // 頁首搜尋：輸入框立即反映，過濾用的 q 延後 300ms（同舊 Dashboard 的 handleSearch）
  const [qIn, setQIn] = useState(searchInit);
  const [q, setQ] = useState(searchInit);
  const timer = useRef(null);
  const onSearch = useCallback((v) => { setQIn(v); clearTimeout(timer.current); timer.current = setTimeout(() => setQ(v), SEARCH_DEBOUNCE); }, []);
  const clearSearch = useCallback(() => { clearTimeout(timer.current); setQIn(""); setQ(""); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const search = useMemo(() => ({ value: qIn, onChange: onSearch, onClear: clearSearch }), [qIn, onSearch, clearSearch]);
  // Timeline 只留「有符合任務」的專案（專案色與時間軸都用完整資料算，不受影響）
  const tlIds = useMemo(() => (q ? new Set(filterBySearch(twp, q).map((t) => t.projectId)) : null), [twp, q]);

  // 任務視窗
  const [modal, setModal] = useState(null);
  const trigger = useRef(null);
  // modalInit（預覽）在掛載後才開：舊 TaskModal 的 DndContext 沒有固定 id，伺服器端先畫出來會造成 aria-describedby 的 hydration 差異
  useEffect(() => {
    if (!modalInit) return;
    if (modalInit.taskId) { const t = twp.find((x) => x.id === modalInit.taskId); if (t) setModal({ task: t, projectId: t.projectId }); }
    else setModal({ task: null, projectId: modalInit.projectId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openTask = useCallback((...a) => {
    onOpenTask?.(...a);
    if (!taskModal) return;
    const [task, o] = a;
    if (!task && !canWrite) return; // viewer 不能新增；編輯視窗本身會是唯讀
    trigger.current = document.activeElement;
    setModal({ task: task || null, projectId: task ? task.projectId : o?.projectId });
  }, [onOpenTask, taskModal, canWrite]);
  const closeModal = useCallback(() => setModal(null), []);
  useEffect(() => { // 關閉後焦點回到觸發元素
    if (modal || !trigger.current) return;
    const el = trigger.current;
    trigger.current = null;
    if (el.isConnected && el !== document.body) el.focus();
  }, [modal]);

  // 專案詳情的「來源分頁」＝進來時的分頁（Timeline 或 Projects；其他來源一律算 Projects），麵包屑與返回都回到它
  const crumbs = tab === "overview" ? [{ l: "首頁" }]
    : proj ? [{ l: "首頁", go: "overview" }, { l: TAB_LABEL[tab], go: tab }, { l: proj.name }]
      : tab === "settings" && setSub === "cloud" ? [{ l: "首頁", go: "overview" }, { l: "Settings", go: "settings" }, { l: "雲朵" }]
        : [{ l: "首頁", go: "overview" }, { l: TAB_LABEL[tab] }];
  const openProject = (id) => { setFocus(null); setProjId(id); setTab((t) => (t === "timeline" ? "timeline" : "projects")); };
  return (
    <CloudLevelProvider level={settings.cloudLevel} setLevel={(v) => updateSetting("cloudLevel", v)}>
      <Header overall={overall} today={today} count={tasks.length} search={search} />
      <div className="wrap">
        <Tabs current={tab} onChange={go} />
        <Breadcrumb items={crumbs} onGo={go} />
        {proj
          ? <ProjectDetail key={proj.id} project={proj} projects={projects} twp={twp} subtasks={subtasks} userNames={userNames} today={today}
              actions={actions} onBack={() => go(tab)} onOpenTask={openTask} initialExpanded={detailInit?.expanded} searchQ={q} onClearSearch={clearSearch} />
          : tab === "overview"
          ? <Overview twp={twp} projects={projects} userName={userName} userNames={userNames} today={today} searchQ={q}
              onJumpMy={(group) => { setFocus((f) => ({ group, n: (f?.n || 0) + 1 })); setTab("mytasks"); }} onOpenProject={openProject} onOpenTask={openTask} />
          : tab === "mytasks"
            ? <MyTasks twp={twp} projects={projects} userName={userName} today={today} focus={focus} onOpenTask={openTask} searchQ={q} onClearSearch={clearSearch} />
            : tab === "projects"
              ? <Projects twp={twp} projects={projects} today={today} actions={actions} onOpenProject={openProject} initialShowArch={!!projectsInit?.showArch} />
              : tab === "timeline"
                ? <Timeline twp={twp} projects={projects} userNames={userNames} today={today} onOpenProject={openProject} init={timelineInit} onlyIds={tlIds} />
                : tab === "data"
                  ? <Data twp={twp} subtasks={subtasks} projects={projects} config={cfg} today={today} searchQ={q} actions={dActions} />
                  : <Settings sub={setSub} onSub={setSetSub} config={cfg} actions={dActions} preview={{ twp, projects, userName, today }} initSel={settingsInit?.csel} />}
      </div>
      {taskModal && <TaskModalHost req={modal} onClose={closeModal} projects={projects} deps={taskModal} />}
    </CloudLevelProvider>
  );
}
