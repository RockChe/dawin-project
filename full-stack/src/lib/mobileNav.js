import { detailCrumbs, HOME_LABEL } from "./breadcrumbs";

// 手機版導覽狀態：純函式，無 React 依賴。nav = { tab, selectedProjectId, returnTab }。
// returnTab：從別的分頁（例如時程）點進專案詳情時的來源分頁，返回時回到那裡；null = 返回專案清單。

export const jumpToProject = (nav, id) => ({
  tab: "projects", selectedProjectId: id, returnTab: nav.tab === "projects" ? null : nav.tab,
});

export const backFromProject = nav => nav.returnTab
  ? { tab: nav.returnTab, selectedProjectId: null, returnTab: null }
  : { ...nav, selectedProjectId: null };

// 底部分頁列：換到任何分頁（含專案）都清掉選取與來源，專案一律顯示清單。
export const switchTab = (_nav, tab) => ({ tab, selectedProjectId: null, returnTab: null });

/** 專案詳情麵包屑：祖先層 = 來源分頁（沒有就「專案」），可點，onBack 負責實際返回。 */
export function projectDetailCrumbs(name, returnTab, { onHome, onBack }) {
  if (returnTab === "mytasks") return [{ label: HOME_LABEL, onClick: onBack }, { label: name }]; // 手機首頁本身就是祖先
  return detailCrumbs(returnTab || "projects", name, { mobile: true, onHome, onTab: onBack });
}
