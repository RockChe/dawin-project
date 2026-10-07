// 日期短寫：與 today 同年 → MM/DD；其他年份 → YYYY/MM/DD（不用 YY，28/01/31 容易被讀成日/月/年）。
// 缺值回空字串；格式不認得就原樣回傳。today 由呼叫端傳入（不取時鐘，避免 SSR 與 client 不一致）。
export function formatShortDate(s, today) {
  if (!s) return "";
  const [y, m, d] = String(s).split(" ")[0].split(/[-/]/);
  if (!y || !m || !d) return s;
  const md = `${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
  return today && y === String(today).slice(0, 4) ? md : `${y}/${md}`;
}
