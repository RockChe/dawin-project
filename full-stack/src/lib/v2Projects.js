// /v2 Projects 分頁的純函式（卡片資料、排序、眼睛、拖曳）。today 由呼叫端傳入；不碰 server action。
import { STATUSES } from "./constants";
import { PROJECT_COLORS, WX } from "./v2Data";
import { computeProjectStatus } from "@/hooks/useProjectStatus";

/** 排序下拉：[值, 文字]。排序只影響畫面，不持久化（同舊版）。 */
export const SORT_MODES = [["manual", "手動排序"], ["name", "依名稱"], ["created", "依建立時間"], ["progress", "依進度"]];

/**
 * 每個專案一張卡片資料（含已封存），依 projects 順序；顏色依 projects 順序循環（與 Overview／My Tasks 同色）。
 * avg＝任務進度算術平均；counts＝[[狀態, 件數]]（依 STATUSES 順序、只列有件數的）；
 * key／label／cloud＝專案狀況 chip（沒有任務就不給：key=null）。
 */
export function projectCards(twp, projects, today) {
  const byProject = new Map();
  for (const t of twp) { if (!byProject.has(t.projectId)) byProject.set(t.projectId, []); byProject.get(t.projectId).push(t); }
  return projects.map((p, i) => {
    const ts = byProject.get(p.id) || [];
    const st = ts.length ? computeProjectStatus(ts, today) : null;
    const c = {}; for (const t of ts) c[t.status] = (c[t.status] || 0) + 1;
    return {
      id: p.id, name: p.name, color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      archived: !!p.archivedAt, bannerUrl: p.bannerUrl || null, sortOrder: p.sortOrder || 0, createdAt: p.createdAt || null,
      n: ts.length, subs: ts.reduce((a, t) => a + (t.sTotal || 0), 0), avg: st ? st.bar.prog : 0,
      counts: STATUSES.filter((s) => c[s]).map((s) => [s, c[s]]),
      key: st ? st.key : null, label: st ? WX[st.key].label : "", cloud: st ? WX[st.key].cloud : null,
    };
  });
}

/** 主列表：只留未封存，依模式排序（回新陣列）。進度同分、名稱相同時維持原順序（Array.sort 穩定）。 */
export function sortProjects(cards, mode) {
  const list = cards.filter((c) => !c.archived);
  switch (mode) {
    case "name": return list.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    case "created": return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case "progress": return list.sort((a, b) => b.avg - a.avg);
    default: return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

/** hiddenProjects（存 project.id 陣列）加入／移除一個 id。 */
export function toggleHidden(hiddenIds, id) {
  const list = hiddenIds || [];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** @dnd-kit onDragEnd：落在別的專案上才呼叫 reorderProjects(activeId, overId)（同舊版）。 */
export const onDragEnd = (reorder) => ({ active, over }) => {
  if (active && over && active.id !== over.id) reorder(active.id, over.id);
};
