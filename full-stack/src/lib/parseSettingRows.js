// user_settings 列 → { key: 已解析的值 }。getUserSettings 與 getInitialData 共用，
// 兩邊解析規則（壞 JSON 退回原字串）必須一致，否則首屏設定與後續讀到的不同。
export function parseSettingRows(rows) {
  const result = {};
  for (const r of rows) {
    try { result[r.key] = JSON.parse(r.value); }
    catch (e) { console.warn(`[parseSettingRows] JSON parse failed for key "${r.key}":`, e.message); result[r.key] = r.value; }
  }
  return result;
}
