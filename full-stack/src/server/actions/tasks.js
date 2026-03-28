'use server';

import { db } from '@/server/db';
import { tasks, subtasks, links, files, projects, users } from '@/server/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { safeRequireAuth, safeRequireAdmin } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2';
import { isValidUUID } from '@/lib/utils';

// ── Tasks ──

export async function getAllTasks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  return db.select().from(tasks).orderBy(asc(tasks.sortOrder));
}

export async function createTask(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

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

    const result = await db.insert(tasks).values({
      projectId: data.projectId,
      task: data.task.trim(),
      status: data.status || '待辦',
      category: data.category || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      duration: data.duration || null,
      owner: data.owner || null,
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
}

export async function updateTask(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid task ID' };

  // Whitelist allowed fields to prevent tampering with createdBy, projectId, etc.
  const ALLOWED = ['task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder'];
  const updateData = { updatedAt: new Date() };
  for (const key of ALLOWED) {
    if (key in data) updateData[key] = data[key];
  }

  // Validate owner(s) exist in users table (supports comma-separated multi-owner)
  if (updateData.owner) {
    const ownerNames = updateData.owner.split(',').map(s => s.trim()).filter(Boolean);
    if (ownerNames.length > 0) {
      const found = await db.select({ name: users.name }).from(users).where(inArray(users.name, ownerNames));
      const foundNames = new Set(found.map(u => u.name));
      const missing = ownerNames.filter(n => !foundNames.has(n));
      if (missing.length > 0) return { error: `Owner "${missing.join(', ')}" 不存在` };
    }
  }

  try {
    await db.update(tasks).set(updateData).where(eq(tasks.id, id));
    return { success: true };
  } catch (err) {
    console.error("updateTask error:", err);
    return { error: err.message || "更新任務失敗" };
  }
}

export async function deleteTask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid task ID' };

  try {
    // 1. Collect R2 keys before DB cascade removes file records
    const taskFiles = await db.select({ r2Key: files.r2Key }).from(files).where(eq(files.taskId, id));
    const r2Keys = taskFiles.map(f => f.r2Key);

    // 2. Delete task (cascade deletes subtasks, links, files)
    await db.delete(tasks).where(eq(tasks.id, id));

    // 3. Best-effort R2 cleanup
    for (const key of r2Keys) {
      try { await deleteFromR2(key); } catch (e) { console.error('[deleteTask] R2 cleanup failed (orphan):', key, e); }
    }

    return { success: true };
  } catch (err) {
    console.error("deleteTask error:", err);
    return { error: err.message || "刪除任務失敗" };
  }
}

// ── Subtasks ──

export async function getAllSubtasks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  return db.select().from(subtasks).orderBy(asc(subtasks.sortOrder));
}

export async function createSubtask(data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!data.taskId || !isValidUUID(data.taskId)) return { error: 'Invalid taskId' };
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return { error: '子任務名稱不可為空' };
  }

  try {
    const result = await db.insert(subtasks).values({
      taskId: data.taskId,
      name: data.name.trim(),
      owner: data.owner || null,
      done: data.done || false,
      doneDate: data.doneDate || null,
      notes: data.notes || null,
      sortOrder: data.sortOrder || 0,
    }).returning();

    return { success: true, subtask: result[0] };
  } catch (err) {
    console.error("createSubtask error:", err);
    return { error: err.message || "建立子任務失敗" };
  }
}

export async function updateSubtask(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid subtask ID' };

  // Whitelist allowed fields
  const ALLOWED = ['name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder'];
  const updateData = {};
  for (const key of ALLOWED) {
    if (key in data) updateData[key] = data[key];
  }

  try {
    await db.update(subtasks).set(updateData).where(eq(subtasks.id, id));
    return { success: true };
  } catch (err) {
    console.error("updateSubtask error:", err);
    return { error: err.message || "更新子任務失敗" };
  }
}

export async function deleteSubtask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid subtask ID' };

  try {
    await db.delete(subtasks).where(eq(subtasks.id, id));
    return { success: true };
  } catch (err) {
    console.error("deleteSubtask error:", err);
    return { error: err.message || "刪除子任務失敗" };
  }
}

export async function toggleSubtask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid subtask ID' };

  try {
    const result = await db.select().from(subtasks).where(eq(subtasks.id, id)).limit(1);
    if (!result[0]) return { error: 'Subtask not found' };

    const sub = result[0];
    const newDone = !sub.done;

    await db.update(subtasks).set({
      done: newDone,
      doneDate: newDone ? new Date().toISOString().split('T')[0] : null,
    }).where(eq(subtasks.id, id));

    return { success: true };
  } catch (err) {
    console.error("toggleSubtask error:", err);
    return { error: err.message || "切換子任務狀態失敗" };
  }
}

// ── Links ──

export async function getAllLinks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  return db.select().from(links).orderBy(desc(links.createdAt));
}

export async function createLink(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

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
}

export async function deleteLink(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid link ID' };

  try {
    await db.delete(links).where(eq(links.id, id));
    return { success: true };
  } catch (err) {
    console.error("deleteLink error:", err);
    return { error: err.message || "刪除連結失敗" };
  }
}

// ── Files ──

export async function getAllFiles() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  return db.select().from(files).orderBy(desc(files.createdAt));
}

export async function createFileRecord(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

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
}

export async function deleteFile(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

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
}

// ── Upsert (import) ──

export async function upsertTasks(importedTasks) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

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
        await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, existing[0].id));
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
}

// ── Batch Update ──

export async function updateManyTasks(ids, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
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
  if (updateData.owner) {
    const ownerNames = updateData.owner.split(',').map(s => s.trim()).filter(Boolean);
    if (ownerNames.length > 0) {
      const found = await db.select({ name: users.name }).from(users).where(inArray(users.name, ownerNames));
      const foundNames = new Set(found.map(u => u.name));
      const missing = ownerNames.filter(n => !foundNames.has(n));
      if (missing.length > 0) return { error: `Owner "${missing.join(', ')}" 不存在` };
    }
  }

  try {
    await db.update(tasks).set(updateData).where(inArray(tasks.id, ids));
    return { success: true, updated: ids.length };
  } catch (err) {
    console.error("updateManyTasks error:", err);
    return { error: err.message || "批次更新失敗" };
  }
}

// ── Batch Delete ──

export async function deleteManyTasks(ids) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
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

    // 3. Best-effort R2 cleanup
    for (const key of r2Keys) {
      try { await deleteFromR2(key); } catch (e) { console.error('[deleteManyTasks] R2 cleanup failed (orphan):', key, e); }
    }

    return { success: true, deleted: ids.length };
  } catch (err) {
    console.error("deleteManyTasks error:", err);
    return { error: err.message || "批次刪除失敗" };
  }
}

// ── Clean All (super_admin only) ──

export async function deleteAllTasks() {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    // 1. Collect all R2 keys
    const allFiles = await db.select({ r2Key: files.r2Key }).from(files);
    const r2Keys = allFiles.map(f => f.r2Key);

    // 2. Delete all tasks (cascade deletes subtasks, links, files)
    await db.delete(tasks);

    // 3. Best-effort R2 cleanup
    for (const key of r2Keys) {
      try { await deleteFromR2(key); } catch (e) { console.error('[deleteAllTasks] R2 cleanup failed (orphan):', key, e); }
    }

    return { success: true };
  } catch (err) {
    console.error("deleteAllTasks error:", err);
    return { error: err.message || "清除所有任務失敗" };
  }
}

// ── Dashboard Data (aggregated) ──

export async function getDashboardData() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const [taskRows, allSubtasks, allLinks, allFiles] = await Promise.all([
    db.select({
      id: tasks.id, projectId: tasks.projectId, task: tasks.task,
      status: tasks.status, category: tasks.category,
      startDate: tasks.startDate, endDate: tasks.endDate,
      duration: tasks.duration, owner: tasks.owner,
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
}
