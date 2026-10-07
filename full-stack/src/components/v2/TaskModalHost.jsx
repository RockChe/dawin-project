"use client";
import TaskModal from "@/components/dashboard/TaskModal";

// 任務視窗（Task 8）：第一版直接嵌入現有舊 TaskModal，不重畫。
// - 主題：TaskModal 用行內色 X（useTheme），v2 與它共用根 ThemeProvider 的 themeKey（R6），所以淺／深色天然一致；
//   權限：TaskModal 內部用 useCan('write')，v2 根節點已掛 PermissionProvider，viewer 自動唯讀。
// - req：null＝關閉；{ task, projectId }，task 為 null＝新增（專案預填）、否則編輯該任務列（twp 列，含 project 名稱）。
// - deps：TaskModal 需要的資料與處理函式（addTask／updateTask／addSub／…／allS／allL／allF／configCats／configOwners／showToast），
//   線上版由 useTaskManager 提供（行為同舊 Dashboard），預覽是無副作用的 no-op。
// - 外層 .v2-modal-host 只負責層級（比 toast 高，錯誤 toast 才看得到）；遮罩、對話框本體仍是舊 TaskModal 的。
//   已知例外（設計差異）：modal 內 12–13px 小字照舊，不符 v2 最小 14px。
export default function TaskModalHost({ req, onClose, projects = [], deps }) {
  if (!req) return null;
  const isNew = !req.task;
  const projectId = req.projectId ?? req.task?.projectId;
  const projectName = projects.find((p) => p.id === projectId)?.name || req.task?.project || "";
  return (
    <div className="v2-modal-host">
      <TaskModal
        key={req.task?.id ?? "new"}
        task={isNew ? "new" : req.task}
        projectId={projectId}
        projectName={projectName}
        onClose={onClose}
        {...deps}
      />
    </div>
  );
}
