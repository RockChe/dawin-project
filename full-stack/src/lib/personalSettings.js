// 個人設定（user_settings）相關的純函式：tab 驗證、時間尺度驗證、舊 localStorage 一次性遷移、
// Overview 專案排序。無 React 依賴，方便單測。

export const TAB_KEYS = ["overview", "mytasks", "projects", "timeline", "table", "settings"];
export const TIME_DIMS = ["日", "週", "月", "季"];

export const resolveTab = (raw) => (TAB_KEYS.includes(raw) ? raw : "overview");
export const resolveTimeDim = (raw) => (TIME_DIMS.includes(raw) ? raw : "月");

export const CLOUD_LEVELS = ["full", "lite", "off"];
export const TIMELINE_VIEWS = ["gantt", "card"];
export const resolveCloudLevel = (raw) => (CLOUD_LEVELS.includes(raw) ? raw : "full");
export const resolveTimelineView = (raw) => (TIMELINE_VIEWS.includes(raw) ? raw : "gantt");

// 雲朵動態（bob／fly）：個人設定 cloudMotion，只有明確 false 才關；與系統「減少動態」取交集（系統要求減少時一律停止）。
export const resolveCloudMotion = (raw) => raw !== false;
export const effectiveCloudMotion = (raw, reducedMotion) => resolveCloudMotion(raw) && !reducedMotion;

const GW = { day: 20, week: 50, month: 50, quarter: 100 };
export const DEFAULT_GANTT_WIDTHS = { overview: { ...GW }, project: { ...GW }, timeline: { ...GW } };

/** 已存的 ganttWidths 缺哪個 view / 哪個 key 就用預設補，不讓壞資料讓 Gantt 算出 NaN。 */
export function resolveGanttWidths(saved) {
  const out = {};
  for (const v of Object.keys(DEFAULT_GANTT_WIDTHS)) out[v] = { ...DEFAULT_GANTT_WIDTHS[v], ...(saved?.[v] || {}) };
  return out;
}

const posInt = (raw) => { const n = parseInt(raw); return n > 0 ? n : undefined; };

// 設定 key → [舊 localStorage key, 解析器]（解析器回 undefined = 無效，不遷移）。
const LEGACY = {
  activeTab: ["dash-activeTab", (raw) => (TAB_KEYS.includes(raw) ? raw : undefined)],
  timelineHeight: ["dash-timelineHeight", posInt],
  upcomingDays: ["dash-upcomingDays", posInt],
  upcomingLimit: ["dash-upcomingLimit", posInt],
  ganttWidths: ["dash-ganttWidths", (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    // 最舊格式：只存單一組寬度（無 overview/project/timeline 分組），攤成三份。
    if (parsed.day !== undefined && !parsed.overview) return { overview: { ...parsed }, project: { ...parsed }, timeline: { ...parsed } };
    return parsed;
  }],
};

/**
 * 一次性遷移：伺服器上「沒有」該 key 的值、但舊 localStorage 有有效值 → 回傳要採用並寫入的 { key: value }。
 * 伺服器已有值（含 0 之類 falsy）一律不動；兩邊都沒有就不回傳。不刪舊 localStorage。
 */
export function collectLegacySettings(settings, storage) {
  const out = {};
  for (const [key, [lsKey, parse]] of Object.entries(LEGACY)) {
    if (settings?.[key] !== undefined) continue;
    try {
      const raw = storage?.getItem(lsKey);
      if (raw == null) continue;
      const v = parse(raw);
      if (v !== undefined) out[key] = v;
    } catch { /* storage 不可用或 JSON 壞掉 → 當作沒有 */ }
  }
  return out;
}

/**
 * Overview 的專案列順序 = Projects 分頁順序（projects 由伺服器依 sortOrder, createdAt 排好；
 * 這裡再以 sortOrder 做穩定排序，同值保留陣列順序）。不在 projects 內的排最後、維持原順序。
 */
export function orderProjBars(bars, projects) {
  if (!projects?.length) return bars;
  const rank = new Map([...projects].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((p, i) => [p.name, i]));
  return bars
    .map((b, i) => [b, i])
    .sort((x, y) => (rank.get(x[0].name) ?? Infinity) - (rank.get(y[0].name) ?? Infinity) || x[1] - y[1])
    .map(([b]) => b);
}
