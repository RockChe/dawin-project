// tasks.owner 由子任務 owner 自動帶出（decision-task-owner-model 方案 A）。
// 兩邊 owner 都是逗號分隔字串；TagInput 存成 "A,B"（無空白），清空時存 "—"。
//
// 關注人（task-lead mockup）：tasks.watchers 是第二個逗號分隔欄位（同 token 格式），
// 掛名關注、不執行子任務。tasks.owner（API / chatbot 讀的相容欄位）= 執行人 ∪ 關注人，執行人在前、去重。
// 執行人 = 有子任務 owner 時取子任務聯集；否則是手動編輯的執行人——沒有第三個欄位可存，
// 所以以 ownerTokens(owner) − ownerTokens(watchers) 復原。
// 邊界：既是手動執行人又是關注人的人，在「沒有子任務 owner」時只會顯示為關注人（復原時被扣掉）。
//
// 伺服端 SQL 版（server/actions/tasks.js 的 DERIVED_OWNER_SQL / UNION_SQL）必須維持同一套規則：
// 依 sort_order → created_at 收集 token、去空白、丟掉 ''/'—'、同名留第一次、以 ',' 串接；關注人接在後面。

const EMPTY_TOKENS = new Set(['', '—']);

export function ownerTokens(owner) {
  return String(owner ?? '').split(',').map(s => s.trim()).filter(t => !EMPTY_TOKENS.has(t));
}

const time = v => (v ? +new Date(v) || 0 : 0);

// Array.prototype.sort 是穩定排序：sortOrder、createdAt 都相同時保持輸入順序。
function inSubOrder(subs) {
  return [...subs].sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0)) || (time(a.createdAt) - time(b.createdAt)));
}

export function hasSubOwners(subs) {
  return (subs || []).some(s => ownerTokens(s.owner).length > 0);
}

/** 子任務 owner 的 token 聯集（依子任務順序、同名留第一次）；沒有 → []。 */
export function subOwnerTokens(subs) {
  return [...new Set(inSubOrder(subs || []).flatMap(s => ownerTokens(s.owner)))];
}

export const watcherTokens = (task) => ownerTokens(task?.watchers);

/** 任務的執行人 token：有子任務 owner → 子任務聯集；否則 owner 扣掉關注人（復原手動執行人，見檔頭邊界說明）。 */
export function execTokens(task, subs) {
  const derived = subOwnerTokens(subs);
  if (derived.length) return derived;
  const w = new Set(watcherTokens(task));
  return ownerTokens(task?.owner).filter(t => !w.has(t));
}

/**
 * 任務負責人 = 執行人 ∪ 關注人。有子任務 owner → 子任務聯集 ∪ 關注人（蓋過手動 owner）；
 * 沒有 → 手動 owner：已含全部關注人就原樣回傳，缺的補在後面。
 * @param {Array<{owner?: string|null, sortOrder?: number, createdAt?: any}>} subs 該任務的子任務
 * @param {string|null|undefined} manualOwner 任務目前存的 owner（沒有子任務 owner 時視為手動執行人）
 * @param {string|null|undefined} [watchers] 關注人（省略 = 無，行為與舊版相同）
 */
export function deriveTaskOwner(subs, manualOwner, watchers) {
  const w = ownerTokens(watchers);
  const tokens = subOwnerTokens(subs);
  if (tokens.length) return [...new Set([...tokens, ...w])].join(',');
  const manual = ownerTokens(manualOwner);
  if (w.every(t => manual.includes(t))) return manualOwner;
  return [...new Set([...manual, ...w])].join(',');
}

/** 我的任務身分：透過子任務執行 → 'executor'；關注人但不是執行人 → 'watcher'；其他（含單純任務 owner）→ null。 */
export function taskRole(task, subs, name) {
  if (!name) return null;
  if (subOwnerTokens(subs).includes(name)) return 'executor';
  return watcherTokens(task).includes(name) ? 'watcher' : null;
}

/**
 * backfill 用：只處理有子任務 owner 的任務。推得執行人 ≠ 現值 owner 時，
 * 「現在 owner 裡有、但不在推得執行人裡」的人會被擠掉 → 轉成關注人（接在既有關注人後面），
 * 新 owner = 推得執行人 ∪ 關注人。比較 token 名單（含順序），純空白差異不算。純函式，不碰 DB。
 * @returns {Array<{id: string, task: string, from: string|null, to: string, fromWatchers: string|null, toWatchers: string|null}>}
 */
export function planOwnerBackfill(tasks, subtasks) {
  const byTask = new Map();
  for (const s of subtasks) {
    if (!byTask.has(s.taskId)) byTask.set(s.taskId, []);
    byTask.get(s.taskId).push(s);
  }
  const plan = [];
  for (const t of tasks) {
    const derived = subOwnerTokens(byTask.get(t.id));
    if (!derived.length) continue; // 沒有子任務 owner → 維持手動 owner
    const oldW = ownerTokens(t.watchers);
    const lost = ownerTokens(t.owner).filter(n => !derived.includes(n) && !oldW.includes(n));
    const newW = [...oldW, ...lost];
    const to = [...new Set([...derived, ...newW])].join(',');
    if (to !== ownerTokens(t.owner).join(',') || lost.length) {
      plan.push({
        id: t.id, task: t.task, from: t.owner ?? null, to,
        fromWatchers: t.watchers ?? null, toWatchers: newW.length ? newW.join(',') : (t.watchers ?? null),
      });
    }
  }
  return plan;
}
