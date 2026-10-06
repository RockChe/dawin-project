// tasks.owner 由子任務 owner 自動帶出（decision-task-owner-model 方案 A）。
// 兩邊 owner 都是逗號分隔字串；TagInput 存成 "A,B"（無空白），清空時存 "—"。
// 伺服端 SQL 版（server/actions/tasks.js 的 derivedOwnerSql）必須維持同一套規則：
// 依 sort_order → created_at 收集 token、去空白、丟掉 ''/'—'、同名留第一次、以 ',' 串接。

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

/**
 * 任務負責人 = 底下子任務負責人的聯集。沒有任何子任務有 owner → 原樣回傳手動 owner。
 * @param {Array<{owner?: string|null, sortOrder?: number, createdAt?: any}>} subs 該任務的子任務
 * @param {string|null|undefined} manualOwner 任務目前存的 owner
 */
export function deriveTaskOwner(subs, manualOwner) {
  const tokens = [...new Set(inSubOrder(subs || []).flatMap(s => ownerTokens(s.owner)))];
  return tokens.length ? tokens.join(',') : manualOwner;
}

/**
 * backfill 用：回傳「推得值 ≠ 現值」的任務。比較 token 名單（含順序），
 * 所以 "Amy, Bob" 與 "Amy,Bob" 只是空白不同不算差異。純函式，不碰 DB。
 * @returns {Array<{id: string, task: string, from: string|null, to: string}>}
 */
export function planOwnerBackfill(tasks, subtasks) {
  const byTask = new Map();
  for (const s of subtasks) {
    if (!byTask.has(s.taskId)) byTask.set(s.taskId, []);
    byTask.get(s.taskId).push(s);
  }
  const plan = [];
  for (const t of tasks) {
    const to = deriveTaskOwner(byTask.get(t.id), t.owner);
    if (ownerTokens(to).join('\n') !== ownerTokens(t.owner).join('\n')) {
      plan.push({ id: t.id, task: t.task, from: t.owner ?? null, to });
    }
  }
  return plan;
}
