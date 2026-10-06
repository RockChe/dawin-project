// 狀態篩選（多選）：選取集合以陣列表示，[] = 不篩。
// 與 GanttTimeline 的 fieldMatches 陣列形式、ProjectsTab 的 projectTaskView.status 同一表示法。

/** 切換一個狀態；'全部' 清空選取。回傳新陣列，不改動輸入。 */
export function toggleStatus(sel, s) {
  if (s === '全部') return [];
  return sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s];
}

/** 狀態是否通過篩選（空／未提供 = 全過；否則取聯集）。 */
export function matchesStatusFilter(status, sel) {
  return !sel || sel.length === 0 || sel.includes(status);
}
