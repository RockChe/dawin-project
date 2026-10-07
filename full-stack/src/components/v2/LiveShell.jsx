"use client";
import { useMemo, useRef } from "react";
import useTaskManager from "@/hooks/useTaskManager";
import useForbiddenHandler from "@/hooks/useForbiddenHandler";
import { deleteProjectBanner } from "@/server/actions/projects";
import { makeBannerActions } from "@/lib/v2Banner";
import Shell from "./Shell";

// 線上版：任務／專案資料與寫入沿用 useTaskManager（樂觀更新＋失敗回復＋FORBIDDEN 處理都在 hook 裡），
// 不新增 server action。成功 toast 沿用舊 ProjectsTab 的文案；失敗 toast 由 hook 負責。
// 專案詳情的任務／子任務動作（updateTask、toggleSub…）直接是 hook 的同名函式；notify＝完成任務的播報 toast。
// 專案改名＝hook 的 renameProject（成功／失敗 toast 由 hook 發）；頭像上傳／刪除見 lib/v2Banner（沿用 /api/upload-banner 與 deleteProjectBanner）。
// 任務視窗：嵌入舊 TaskModal，所需資料與處理函式全部取自同一個 useTaskManager（同舊 Dashboard 的接法）。
export default function LiveShell({ data, today, ...rest }) {
  const tm = useTaskManager(data);
  const { showToast, archiveProject, unarchiveProject, deleteProject, addProject, reorderProjects, updateTask, deleteTask, toggleSub, addSub, deleteSub, reorderTasks, renameProject, setProjects } = tm;
  const onForbidden = useForbiddenHandler(showToast);
  const projectsRef = useRef(tm.projects);
  projectsRef.current = tm.projects;
  const banner = useMemo(
    () => makeBannerActions({ setProjects, getProjects: () => projectsRef.current, showToast, onForbidden, deleteBanner: deleteProjectBanner }),
    [setProjects, showToast, onForbidden]);
  const projectActions = useMemo(() => ({
    archive: async (id) => { const r = await archiveProject(id); if (r?.success) showToast("Project archived", "warn"); },
    unarchive: async (id) => { const r = await unarchiveProject(id); if (r?.success) showToast("Project unarchived", "success"); },
    remove: deleteProject,
    add: addProject,
    reorder: reorderProjects,
    updateTask, deleteTask, toggleSub, addSub, deleteSub, reorderTasks,
    notify: showToast,
    rename: renameProject,
    uploadBanner: banner.upload,
    removeBanner: banner.remove,
  }), [showToast, archiveProject, unarchiveProject, deleteProject, addProject, reorderProjects, updateTask, deleteTask, toggleSub, addSub, deleteSub, reorderTasks, renameProject, banner]);
  const { allS, allL, allF, addTask, updateSub, reorderSubs, addLink, addFile, deleteLink, deleteFile, configCats, configOwners } = tm;
  const owners = configOwners?.length ? configOwners : data.userNames; // hook 的 configOwners 要等 effect 才有值，先用 SSR 帶來的使用者名單
  const taskModal = useMemo(() => ({
    addTask, updateTask, allS, addSub, deleteSub, toggleSub, updateSub, reorderSubs,
    configCats: configCats || [], configOwners: owners || [], allL: allL || [], allF: allF || [],
    addLink, addFile, deleteLink, deleteFile, showToast,
  }), [addTask, updateTask, allS, addSub, deleteSub, toggleSub, updateSub, reorderSubs, configCats, owners, allL, allF, addLink, addFile, deleteLink, deleteFile, showToast]);
  // Data／Settings：同一個 useTaskManager 的寫入（匯入、批次、分類…），不新增 server action
  const { importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks, saveConfigCats } = tm;
  const dataActions = useMemo(() => ({
    updateTask, updateSub, deleteTask, deleteSub, toggleSub, addTask, addSub,
    importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks, saveCats: saveConfigCats, notify: showToast,
  }), [updateTask, updateSub, deleteTask, deleteSub, toggleSub, addTask, addSub, importTasks, deleteManyTasks, updateManyTasks, deleteAllTasks, saveConfigCats, showToast]);
  const config = useMemo(() => ({ cats: configCats || [], owners: owners || [] }), [configCats, owners]);
  const t = tm.toast;
  return (
    <>
      <Shell tasks={tm.allT} subtasks={tm.allS} projects={tm.projects} userName={data.session?.name} userNames={data.userNames} today={today} projectActions={projectActions} taskModal={taskModal} dataActions={dataActions} config={config} {...rest} />
      {t && <div className={`v2-toast ${t.type}${t.fading ? " fading" : ""}`} role="status">{t.msg}</div>}
    </>
  );
}
