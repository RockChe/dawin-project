'use server';

import { db } from '@/server/db';
import { tasks, subtasks, links, files, projects } from '@/server/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { safeRequireAuth, safeRequireAdmin } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2';

// UUID validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) { return typeof str === 'string' && UUID_RE.test(str); }

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

  try {
    const updateData = { ...data, updatedAt: new Date() };
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
    // Delete associated R2 files first
    const taskFiles = await db.select().from(files).where(eq(files.taskId, id));
    for (const f of taskFiles) {
      try { await deleteFromR2(f.r2Key); } catch (e) { console.error('R2 delete error:', e); }
    }

    await db.delete(tasks).where(eq(tasks.id, id));
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

  try {
    await db.update(subtasks).set(data).where(eq(subtasks.id, id));
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
    const result = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (result[0]) {
      try { await deleteFromR2(result[0].r2Key); } catch (e) { console.error('R2 delete error:', e); }
    }
    await db.delete(files).where(eq(files.id, id));
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

// ── Batch Delete ──

export async function deleteManyTasks(ids) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'No task IDs provided' };
  if (ids.length > 500) return { error: 'Too many IDs (max 500)' };

  // Validate all IDs are UUIDs
  if (!ids.every(isValidUUID)) return { error: 'Invalid task ID format' };

  try {
    // Batch query all files for these tasks
    const taskFiles = await db.select().from(files).where(inArray(files.taskId, ids));
    for (const f of taskFiles) {
      try { await deleteFromR2(f.r2Key); } catch (e) { console.error('R2 delete error:', e); }
    }

    // Batch delete tasks
    await db.delete(tasks).where(inArray(tasks.id, ids));

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

  // Delete all R2 files
  const allFiles = await db.select().from(files);
  for (const f of allFiles) {
    try { await deleteFromR2(f.r2Key); } catch (e) { console.error('R2 delete error:', e); }
  }

  // Delete all tasks (cascade deletes subtasks, links, files)
  await db.delete(tasks);

  return { success: true };
}

// ── Dashboard Data (aggregated) ──

export async function getDashboardData() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const [allTasks, allSubtasks, allLinks, allFiles] = await Promise.all([
    db.select().from(tasks).orderBy(asc(tasks.sortOrder)),
    db.select().from(subtasks).orderBy(asc(subtasks.sortOrder)),
    db.select().from(links).orderBy(desc(links.createdAt)),
    db.select().from(files).orderBy(desc(files.createdAt)),
  ]);

  return { tasks: allTasks, subtasks: allSubtasks, links: allLinks, files: allFiles };
}
