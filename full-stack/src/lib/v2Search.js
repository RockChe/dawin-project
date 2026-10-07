// 頁首搜尋規則（沿用舊 Dashboard 的 searchQ）：任務名／專案名／負責人／備註，不分大小寫的子字串。
// 任務列要有 project（專案名稱）——v2 的 twp（buildTwp）已帶。
export function matchesSearch(t, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [t.task, t.project, t.owner, t.notes].some((v) => (v || '').toLowerCase().includes(s));
}

/** 沒有搜尋字串就回傳原陣列（引用不變，memo 不會白算）。 */
export const filterBySearch = (rows, q) => (q ? rows.filter((t) => matchesSearch(t, q)) : rows);
