const MS = 864e5;
const RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

// YYYY-MM-DD 或 YYYY/MM/DD → 整數日序（UTC，無 DST 問題）；缺值/格式錯/不存在的日期 → null
export function dayIndex(str) {
  if (typeof str !== 'string') return null;
  const m = RE.exec(str.trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d);
  const c = new Date(t);
  if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d) return null;
  return Math.round(t / MS);
}
