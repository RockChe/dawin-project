'use server';

import { db } from '@/server/db';
import { tasks, subtasks, links, files, projects, users } from '@/server/db/schema';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import { deleteFromR2 } from '@/lib/r2';
import { isValidUUID, toBusinessDateString } from '@/lib/utils';
import { withCap } from '@/lib/withCap';
import { logAudit } from '@/lib/audit';
import { ownerTokens, deriveTaskOwner } from '@/lib/taskOwner';

// ── tasks.owner 由子任務 owner 自動帶出 ──
// 規則與 lib/taskOwner.js 的 deriveTaskOwner 相同：依 sort_order → created_at 取子任務 owner 的 token，
// 去空白、丟掉 ''/'—'、同名只留第一次、以 ',' 串接。沒有任何子任務 owner → NULL（呼叫端用 COALESCE 保留原值）。
// 相關子查詢綁在外層的 tasks.id，所以只能放在 UPDATE tasks ... 裡用。
// 全部在 SQL 內算完（不先讀回 JS 再寫），子任務寫入與父任務重算才能塞進同一個 db.batch 原子執行。
const DERIVED_OWNER_SQL = `(SELECT string_agg(d.tok, ',' ORDER BY d.pos) FROM (
  SELECT x.tok, MIN(x.pos) AS pos FROM (
    SELECT btrim(u.piece) AS tok,
           row_number() OVER (ORDER BY s.sort_order, s.created_at, s.id, u.ord) AS pos
    FROM subtasks s
    CROSS JOIN LATERAL unnest(string_to_array(s.owner, ',')) WITH ORDINALITY AS u(piece, ord)
    WHERE s.task_id = tasks.id
  ) x WHERE x.tok <> '' AND x.tok <> '—' GROUP BY x.tok
) d)`.replace(/\s+/g, ' ');

// ── 關注人（tasks.watchers）：tasks.owner = 執行人 ∪ 關注人（執行人在前、同名留第一次）。規則見 lib/taskOwner.js 檔頭 ──
// 兩串逗號清單 a、b 的聯集（a 先 b 後、去空白、丟掉 ''/'—'）；全空 → NULL。a / b 是 sql 片段（欄位、子查詢或參數）。
const unionSql = (a, b) => sql`(SELECT string_agg(y.tok, ',' ORDER BY y.pos) FROM (
  SELECT x.tok, MIN(x.pos) AS pos FROM (
    SELECT btrim(u.piece) AS tok, u.ord AS pos FROM unnest(string_to_array(${a}, ',')) WITH ORDINALITY AS u(piece, ord)
    UNION ALL
    SELECT btrim(v.piece), 1000000 + v.ord FROM unnest(string_to_array(${b}, ',')) WITH ORDINALITY AS v(piece, ord)
  ) x WHERE x.tok <> '' AND x.tok <> '—' GROUP BY x.tok
) y)`;

const DERIVED = sql.raw(DERIVED_OWNER_SQL);
const WATCHERS_COL = sql.raw('tasks.watchers');
// 沒有子任務 owner 時，手動執行人 = 現有 owner 扣掉現有關注人（沒有第三個欄位可存，見 lib/taskOwner.js 邊界說明）
const MANUAL_EXEC = sql.raw(`(SELECT string_agg(btrim(m.piece), ',' ORDER BY m.ord) FROM unnest(string_to_array(tasks.owner, ',')) WITH ORDINALITY AS m(piece, ord)
  WHERE btrim(m.piece) NOT IN ('', '—') AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(tasks.watchers, ',')) AS w(piece) WHERE btrim(w.piece) = btrim(m.piece)))`.replace(/\s+/g, ' '));

// 寫入一個手動 owner：有子任務 owner 時以推得值為準（傳入值不報錯、直接忽略），再接上關注人。
// 全空（清空 owner 且沒有關注人）→ 退回傳入值，維持 "—" / null 的舊行為。watchers 預設沿用資料庫現值。
const ownerUnlessDerived = (manual, watchers = WATCHERS_COL) =>
  sql`COALESCE(${unionSql(sql`COALESCE(${DERIVED}, ${manual})`, watchers)}, ${manual})`;

// 只改關注人（沒帶 owner）：執行人 = 推得值，否則由現有 owner 復原；再接上新關注人。全空 → NULL。
const ownerFromWatchers = (watchers) => unionSql(sql`COALESCE(${DERIVED}, ${MANUAL_EXEC})`, watchers);

// 關注人名單：正規化成 "A,B"（空 → null）並驗證都是已知使用者。回傳 { value } 或 { error }。
const normalizeWatchers = async (raw) => {
  const names = ownerTokens(raw);
  if (names.length) {
    const found = await db.select({ name: users.name }).from(users).where(inArray(users.name, names));
    const foundNames = new Set(found.map(u => u.name));
    const missing = names.filter(n => !foundNames.has(n));
    if (missing.length > 0) return { error: `關注人 "${missing.join(', ')}" 不存在` };
  }
  const value = names.length ? names.join(',') : null;
  if (value && value.length > 500) return { error: '關注人名單過長（上限 500 字元）' };
  return { value };
};

// 這些任務裡「有子任務 owner」的 id 集合。傳入的 owner 對它們會被 SQL 忽略，呼叫端據此跳過驗證。
const tasksWithDerivedOwner = async (ids) => {
  const rows = await db.select({ taskId: subtasks.taskId, owner: subtasks.owner }).from(subtasks).where(inArray(subtasks.taskId, ids));
  return new Set(rows.filter(r => ownerTokens(r.owner).length > 0).map(r => r.taskId));
};

// 重算單一任務的 owner；taskIdSql 是 SQL 片段（參數或子查詢）。回傳 db.batch 可收的 statement。
// 有子任務 owner → 推得值 ∪ 關注人；沒有 → 維持原 owner（它已含關注人）。
const syncTaskOwner = (taskIdSql) =>
  db.execute(sql`UPDATE tasks SET owner = COALESCE(CASE WHEN ${DERIVED} IS NULL THEN NULL ELSE ${unionSql(DERIVED, WATCHERS_COL)} END, tasks.owner) WHERE tasks.id = ${taskIdSql}`);

// ── Tasks ──

export async function getAllTasks() {
  return withCap('read', async () => {
    return db.select().from(tasks).orderBy(asc(tasks.sortOrder));
  });
}

export async function createTask(data) {
  return withCap('write', async (session) => {
    if (!data.projectId || !isValidUUID(data.projectId)) {
      return { error: 'Invalid projectId' };
    }
    if (!data.task || typeof data.task !== 'string' || !data.task.trim()) {
      return { error: '任務名稱不可為空' };
    }

    try {
      // Verify project exists
      const proj = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, data.projectId)).limit(1);
      if (!proj[0]) return { error: '專案不存在' };

      // Validate owner(s) exist in users table (supports comma-separated multi-owner)
      if (data.owner) {
        const ownerNames = data.owner.split(',').map(s => s.trim()).filter(Boolean);
        if (ownerNames.length > 0) {
          const found = await db.select({ name: users.name }).from(users).where(inArray(users.name, ownerNames));
          const foundNames = new Set(found.map(u => u.name));
          const missing = ownerNames.filter(n => !foundNames.has(n));
          if (missing.length > 0) return { error: `Owner "${missing.join(', ')}" 不存在` };
        }
      }

      // 關注人：驗證後寫入；owner 相容欄位 = 執行人 ∪ 關注人（新任務還沒有子任務，直接在 JS 合併）
      const w = await normalizeWatchers(data.watchers);
      if (w.error) return { error: w.error };

      const result = await db.insert(tasks).values({
        projectId: data.projectId,
        task: data.task.trim(),
        status: data.status || '待辦',
        category: data.category || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        duration: data.duration || null,
        owner: deriveTaskOwner([], data.owner || null, w.value) || null,
        watchers: w.value,
        priority: data.priority || '中',
        notes: data.notes || null,
        sortOrder: data.sortOrder || 0,
        source: 'manual',
        createdBy: session.userId,
      }).returning();

      return { success: true, task: result[0] };
    } catch (err) {
      console.error("createTask error:", err);
      return { error: err.message || "建立任務失敗" };
    }
  });
}

export async function updateTask(id, data) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid task ID' };

    // Whitelist allowed fields to prevent tampering with createdBy, projectId, etc.
    const ALLOWED = ['task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'watchers', 'priority', 'notes', 'sortOrder'];
    const updateData = { updatedAt: new Date() };
    for (const key of ALLOWED) {
      if (key in data) updateData[key] = data[key];
    }

    // Validate owner(s) exist in users table (supports comma-separated multi-owner)
    // 任務有子任務 owner 時傳入的 owner 會被忽略、不會寫入 → 不驗證
    if (updateData.owner && !(await tasksWithDerivedOwner([id])).has(id)) {
      const ownerNames = updateData.owner.split(',').map(s => s.trim()).filter(Boolean);
      if (ownerNames.length > 0) {
        const found = await db.select({ name: users.name }).from(users).where(inArray(users.name, ownerNames));
        const foundNames = new Set(found.map(u => u.name));
        const missing = ownerNames.filter(n => !foundNames.has(n));
        if (missing.length > 0) return { error: `Owner "${missing.join(', ')}" 不存在` };
      }
    }

    // 關注人（獨立欄位，不受子任務影響 → 一律驗證）。正規化後與 owner 重算同一個 UPDATE 寫入。
    let watchersSql;
    if ('watchers' in updateData) {
      const w = await normalizeWatchers(updateData.watchers);
      if (w.error) return { error: w.error };
      updateData.watchers = w.value;
      watchersSql = sql`${w.value}`;
    }

    // 有子任務 owner 的任務以推得值為準：傳進來的 owner 交給 SQL 忽略（不報錯）；owner 一律再接上關注人
    if ('owner' in updateData) updateData.owner = ownerUnlessDerived(updateData.owner ?? null, watchersSql);
    else if (watchersSql) updateData.owner = ownerFromWatchers(watchersSql);

    try {
      await db.update(tasks).set(updateData).where(eq(tasks.id, id));
      return { success: true };
    } catch (err) {
      console.error("updateTask error:", err);
      return { error: err.message || "更新任務失敗" };
    }
  });
}

export async function deleteTask(id) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid task ID' };

    try {
      // 1. Collect R2 keys before DB cascade removes file records
      const taskFiles = await db.select({ r2Key: files.r2Key }).from(files).where(eq(files.taskId, id));
      const r2Keys = taskFiles.map(f => f.r2Key);

      // 2. Delete task (cascade deletes subtasks, links, files)
      await db.delete(tasks).where(eq(tasks.id, id));

      // 3. Best-effort R2 cleanup (parallel)
      await Promise.allSettled(
        r2Keys.map(key => deleteFromR2(key).catch(e => console.error('[deleteTask] R2 cleanup failed (orphan):', key, e)))
      );

      return { success: true };
    } catch (err) {
      console.error("deleteTask error:", err);
      return { error: err.message || "刪除任務失敗" };
    }
  });
}

// 專案內 task 拖移排序：只寫 sort_order，不碰日期。
// neon-http 沒有互動式 transaction → 單一 UPDATE（CASE）一次寫完，天然原子；
// WHERE 再帶 project_id 守門，即使驗證與寫入之間 task 被搬走也不會誤改別的專案。
// CASE 結果要 ::int，否則綁定參數會被推斷成 text（同 reorderProjects 的坑）。
export async function reorderTasks(projectId, orderedTaskIds) {
  return withCap('write', async (session) => {
    if (!isValidUUID(projectId)) return { error: 'Invalid project ID' };
    if (!Array.isArray(orderedTaskIds) || orderedTaskIds.length === 0 || orderedTaskIds.length > 500
      || !orderedTaskIds.every(isValidUUID) || new Set(orderedTaskIds).size !== orderedTaskIds.length) {
      return { error: 'Invalid task IDs' };
    }
    try {
      const owned = await db.select({ id: tasks.id }).from(tasks)
        .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, orderedTaskIds)));
      if (owned.length !== orderedTaskIds.length) return { error: '部分任務不屬於此專案' };

      const chunks = [sql`UPDATE tasks SET sort_order = (CASE`];
      orderedTaskIds.forEach((id, i) => chunks.push(sql` WHEN id = ${id} THEN ${i + 1}`));
      chunks.push(sql` END)::int, updated_at = NOW() WHERE project_id = ${projectId} AND id IN (`);
      chunks.push(sql.join(orderedTaskIds.map(id => sql`${id}`), sql`, `));
      chunks.push(sql`)`);
      await db.execute(sql.join(chunks, sql.raw('')));
      await logAudit('TASK_REORDER', session.userId, {
        resourceType: 'project', resourceId: projectId, detail: `${orderedTaskIds.length} tasks`,
      });
      return { success: true };
    } catch (err) {
      console.error("reorderTasks error:", err);
      return { error: err.message || "重新排序失敗" };
    }
  });
}

// ── Subtasks ──

export async function getAllSubtasks() {
  return withCap('read', async () => {
    return db.select().from(subtasks).orderBy(asc(subtasks.sortOrder));
  });
}

export async function createSubtask(data) {
  return withCap('write', async () => {
    if (!data.taskId || !isValidUUID(data.taskId)) return { error: 'Invalid taskId' };
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      return { error: '子任務名稱不可為空' };
    }

    try {
      // 子任務 INSERT + 父任務 owner 重算：neon-http 無互動式 transaction → 同一個 db.batch 原子執行
      const [result] = await db.batch([
        db.insert(subtasks).values({
          taskId: data.taskId,
          name: data.name.trim(),
          owner: data.owner || null,
          done: data.done || false,
          doneDate: data.doneDate || null,
          notes: data.notes || null,
          sortOrder: data.sortOrder || 0,
        }).returning(),
        syncTaskOwner(sql`${data.taskId}`),
      ]);

      return { success: true, subtask: result[0] };
    } catch (err) {
      console.error("createSubtask error:", err);
      return { error: err.message || "建立子任務失敗" };
    }
  });
}

export async function updateSubtask(id, data) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid subtask ID' };

    // Whitelist allowed fields
    const ALLOWED = ['name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder'];
    const updateData = {};
    for (const key of ALLOWED) {
      if (key in data) updateData[key] = data[key];
    }

    try {
      const write = db.update(subtasks).set(updateData).where(eq(subtasks.id, id));
      // owner / sortOrder 會改變父任務推得的 owner → 同一個 db.batch 內重算；其他欄位維持單一 UPDATE
      if ('owner' in updateData || 'sortOrder' in updateData) {
        await db.batch([write, syncTaskOwner(sql`(SELECT task_id FROM subtasks WHERE id = ${id})`)]);
      } else {
        await write;
      }
      return { success: true };
    } catch (err) {
      console.error("updateSubtask error:", err);
      return { error: err.message || "更新子任務失敗" };
    }
  });
}

export async function deleteSubtask(id) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid subtask ID' };

    try {
      // 刪掉之後就查不到父任務了 → 先讀出 task_id，再把 DELETE 與重算放進同一個 db.batch
      const [row] = await db.select({ taskId: subtasks.taskId }).from(subtasks).where(eq(subtasks.id, id)).limit(1);
      if (row) {
        await db.batch([db.delete(subtasks).where(eq(subtasks.id, id)), syncTaskOwner(sql`${row.taskId}`)]);
      } else {
        await db.delete(subtasks).where(eq(subtasks.id, id));
      }
      return { success: true };
    } catch (err) {
      console.error("deleteSubtask error:", err);
      return { error: err.message || "刪除子任務失敗" };
    }
  });
}

export async function toggleSubtask(id) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid subtask ID' };

    try {
      const result = await db.select().from(subtasks).where(eq(subtasks.id, id)).limit(1);
      if (!result[0]) return { error: 'Subtask not found' };

      const sub = result[0];
      const newDone = !sub.done;
      // Business-zone calendar day, not the runtime's. This runtime is UTC on
      // Vercel, so toISOString() recorded the previous day for anything done
      // before 08:00 Taipei.
      const doneDate = newDone ? toBusinessDateString() : null;

      await db.update(subtasks).set({ done: newDone, doneDate }).where(eq(subtasks.id, id));

      // Returned so the client can reconcile its optimistic guess with the value
      // actually stored — the server is the source of truth for the day boundary.
      return { success: true, done: newDone, doneDate };
    } catch (err) {
      console.error("toggleSubtask error:", err);
      return { error: err.message || "切換子任務狀態失敗" };
    }
  });
}

// ── Links ──

export async function getAllLinks() {
  return withCap('read', async () => {
    return db.select().from(links).orderBy(desc(links.createdAt));
  });
}

export async function createLink(data) {
  return withCap('write', async (session) => {
    if (!data.taskId || !isValidUUID(data.taskId)) return { error: 'Invalid taskId' };
    if (!data.url || typeof data.url !== 'string' || !data.url.trim()) {
      return { error: 'URL 不可為空' };
    }

    // Validate URL protocol
    try {
      const url = new URL(data.url.trim());
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { error: '僅支援 HTTP/HTTPS 連結' };
      }
    } catch {
      return { error: 'URL 格式無效' };
    }

    try {
      const result = await db.insert(links).values({
        taskId: data.taskId,
        url: data.url.trim(),
        title: data.title || null,
        createdBy: session.userId,
      }).returning();

      return { success: true, link: result[0] };
    } catch (err) {
      console.error("createLink error:", err);
      return { error: err.message || "建立連結失敗" };
    }
  });
}

export async function deleteLink(id) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid link ID' };

    try {
      await db.delete(links).where(eq(links.id, id));
      return { success: true };
    } catch (err) {
      console.error("deleteLink error:", err);
      return { error: err.message || "刪除連結失敗" };
    }
  });
}

// ── Files ──

export async function getAllFiles() {
  return withCap('read', async () => {
    return db.select().from(files).orderBy(desc(files.createdAt));
  });
}

export async function createFileRecord(data) {
  return withCap('write', async (session) => {
    if (!data.taskId || !isValidUUID(data.taskId)) return { error: 'Invalid taskId' };

    // Verify task exists before creating file record
    const taskExists = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, data.taskId)).limit(1);
    if (!taskExists[0]) return { error: '任務不存在' };

    try {
      const result = await db.insert(files).values({
        taskId: data.taskId,
        name: data.name,
        size: data.size || null,
        mimeType: data.mimeType || null,
        r2Key: data.r2Key,
        createdBy: session.userId,
      }).returning();

      return { success: true, file: result[0] };
    } catch (err) {
      console.error("createFileRecord error:", err);
      return { error: err.message || "建立檔案記錄失敗" };
    }
  });
}

export async function deleteFile(id) {
  return withCap('write', async () => {
    if (!isValidUUID(id)) return { error: 'Invalid file ID' };

    try {
      // 1. Query to get r2Key before deleting from DB
      const result = await db.select({ r2Key: files.r2Key }).from(files).where(eq(files.id, id)).limit(1);
      if (!result[0]) return { error: '檔案不存在' };
      const r2Key = result[0].r2Key;

      // 2. Delete DB record first (source of truth)
      await db.delete(files).where(eq(files.id, id));

      // 3. Best-effort R2 cleanup
      try { await deleteFromR2(r2Key); } catch (e) { console.error('[deleteFile] R2 cleanup failed (orphan):', r2Key, e); }

      return { success: true };
    } catch (err) {
      console.error("deleteFile error:", err);
      return { error: err.message || "刪除檔案失敗" };
    }
  });
}

// ── Upsert (import) ──

export async function upsertTasks(importedTasks) {
  return withCap('write', async (session) => {
    if (!Array.isArray(importedTasks) || importedTasks.length === 0) {
      return { error: 'No tasks to import' };
    }

    let updated = 0, inserted = 0, failed = 0;

    // Cache project name → id mapping
    const allProjects = await db.select().from(projects);
    const projMap = {};
    allProjects.forEach(p => { projMap[p.name] = p.id; });

    for (const t of importedTasks) {
      const projName = (t.project || '').trim();
      if (!projName || !t.task) { failed++; continue; }

      try {
        // Find or create project
        let projectId = projMap[projName];
        if (!projectId) {
          const maxOrder = allProjects.length > 0
            ? Math.max(...allProjects.map(p => p.sortOrder || 0)) + 1
            : 1;
          const newProj = await db.insert(projects).values({
            name: projName,
            sortOrder: maxOrder,
            source: 'csv_import',
            createdBy: session.userId,
          }).returning();
          projectId = newProj[0].id;
          projMap[projName] = projectId;
          allProjects.push(newProj[0]);
        }

        // Check if task with same projectId + task name exists
        const existing = await db.select().from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.task, t.task)))
          .limit(1);

        const data = {
          status: t.status || '待辦',
          category: t.category || null,
          startDate: t.start || null,
          endDate: t.end || null,
          duration: t.duration || null,
          owner: t.owner || null,
          priority: t.priority || '中',
          notes: t.notes || null,
          sortOrder: t.sort_order || 0,
        };

        if (existing.length > 0) {
          // 既有任務若有子任務 owner，CSV 的 owner 不覆寫推得值
          await db.update(tasks).set({ ...data, owner: ownerUnlessDerived(data.owner), updatedAt: new Date() }).where(eq(tasks.id, existing[0].id));
          updated++;
        } else {
          await db.insert(tasks).values({
            projectId,
            task: t.task,
            ...data,
            source: 'csv_import',
            createdBy: session.userId,
          });
          inserted++;
        }
      } catch (err) {
        console.error(`upsertTasks error for "${t.task}":`, err);
        failed++;
      }
    }

    return { success: true, updated, inserted, failed };
  });
}

// ── Batch Update ──

export async function updateManyTasks(ids, data) {
  return withCap('write', async () => {
    if (!Array.isArray(ids) || ids.length === 0) return { error: 'No task IDs provided' };
    if (ids.length > 500) return { error: 'Too many IDs (max 500)' };
    if (!ids.every(isValidUUID)) return { error: 'Invalid task ID format' };

    const ALLOWED = ['owner', 'status', 'priority', 'category'];
    const updateData = { updatedAt: new Date() };
    for (const key of ALLOWED) {
      if (key in data) updateData[key] = data[key];
    }
    if (Object.keys(updateData).length <= 1) return { error: 'No valid fields to update' };

    // Validate owner(s) exist in users table (supports comma-separated multi-owner)
    // 全部任務都有子任務 owner → owner 一個都不會寫入 → 不驗證；只要有一個會被寫入就照常驗證
    if (updateData.owner && (await tasksWithDerivedOwner(ids)).size < new Set(ids).size) {
      const ownerNames = updateData.owner.split(',').map(s => s.trim()).filter(Boolean);
      if (ownerNames.length > 0) {
        const found = await db.select({ name: users.name }).from(users).where(inArray(users.name, ownerNames));
        const foundNames = new Set(found.map(u => u.name));
        const missing = ownerNames.filter(n => !foundNames.has(n));
        if (missing.length > 0) return { error: `Owner "${missing.join(', ')}" 不存在` };
      }
    }

    // 有子任務 owner 的任務在 SQL 層略過 owner（推得值為準）；其他欄位照寫
    if ('owner' in updateData) updateData.owner = ownerUnlessDerived(updateData.owner ?? null);

    try {
      await db.update(tasks).set(updateData).where(inArray(tasks.id, ids));
      return { success: true, updated: ids.length };
    } catch (err) {
      console.error("updateManyTasks error:", err);
      return { error: err.message || "批次更新失敗" };
    }
  });
}

// ── Batch Delete ──

export async function deleteManyTasks(ids) {
  return withCap('write', async () => {
    if (!Array.isArray(ids) || ids.length === 0) return { error: 'No task IDs provided' };
    if (ids.length > 500) return { error: 'Too many IDs (max 500)' };

    // Validate all IDs are UUIDs
    if (!ids.every(isValidUUID)) return { error: 'Invalid task ID format' };

    try {
      // 1. Collect R2 keys before cascade deletes file records
      const taskFiles = await db.select({ r2Key: files.r2Key }).from(files).where(inArray(files.taskId, ids));
      const r2Keys = taskFiles.map(f => f.r2Key);

      // 2. Batch delete tasks (cascade)
      await db.delete(tasks).where(inArray(tasks.id, ids));

      // 3. Best-effort R2 cleanup (parallel)
      await Promise.allSettled(
        r2Keys.map(key => deleteFromR2(key).catch(e => console.error('[deleteManyTasks] R2 cleanup failed (orphan):', key, e)))
      );

      return { success: true, deleted: ids.length };
    } catch (err) {
      console.error("deleteManyTasks error:", err);
      return { error: err.message || "批次刪除失敗" };
    }
  });
}

// ── Clean All (super_admin only) ──

export async function deleteAllTasks() {
  return withCap('manage', async () => {
    try {
      // 1. Collect all R2 keys
      const allFiles = await db.select({ r2Key: files.r2Key }).from(files);
      const r2Keys = allFiles.map(f => f.r2Key);

      // 2. Delete all tasks (cascade deletes subtasks, links, files)
      await db.delete(tasks);

      // 3. Best-effort R2 cleanup (parallel)
      await Promise.allSettled(
        r2Keys.map(key => deleteFromR2(key).catch(e => console.error('[deleteAllTasks] R2 cleanup failed (orphan):', key, e)))
      );

      return { success: true };
    } catch (err) {
      console.error("deleteAllTasks error:", err);
      return { error: err.message || "清除所有任務失敗" };
    }
  });
}

// ── Dashboard Data (aggregated) ──

export async function getDashboardData() {
  return withCap('read', async () => {
    const [taskRows, allSubtasks, allLinks, allFiles] = await Promise.all([
      db.select({
        id: tasks.id, projectId: tasks.projectId, task: tasks.task,
        status: tasks.status, category: tasks.category,
        startDate: tasks.startDate, endDate: tasks.endDate,
        duration: tasks.duration, owner: tasks.owner, watchers: tasks.watchers,
        priority: tasks.priority, notes: tasks.notes,
        sortOrder: tasks.sortOrder, source: tasks.source,
        createdBy: tasks.createdBy, createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt, creatorName: users.name,
      }).from(tasks).leftJoin(users, eq(tasks.createdBy, users.id))
        .orderBy(asc(tasks.sortOrder)),
      db.select().from(subtasks).orderBy(asc(subtasks.sortOrder)),
      db.select().from(links).orderBy(desc(links.createdAt)),
      db.select().from(files).orderBy(desc(files.createdAt)),
    ]);

    return { tasks: taskRows, subtasks: allSubtasks, links: allLinks, files: allFiles };
  });
}
