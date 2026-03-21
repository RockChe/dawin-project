'use server';

import {
  getAllTasksOrdered,
  getAllSubtasksOrdered,
  getAllLinksOrdered,
  getAllFilesOrdered,
  getAllFileRows,
  getAllProjects,
  findTaskById,
  findTaskByProjectAndName,
  findSubtaskById,
  insertTask,
  updateTask as dalUpdateTask,
  deleteTaskById,
  deleteAllTaskRows,
  insertSubtask,
  updateSubtask as dalUpdateSubtask,
  deleteSubtask as dalDeleteSubtask,
  insertLink,
  deleteLink as dalDeleteLink,
  insertFile,
  findFileById,
  deleteFileById,
  findFilesByTaskId,
  insertProject,
  getMaxProjectSortOrder,
} from '@/lib/sheets-dal';
import { safeRequireAuth, safeRequireAdmin } from '@/lib/auth';
import { deleteFromDrive } from '@/lib/drive';
import { cacheGet, cacheSet, cacheInvalidate } from '@/lib/cache';

const DASHBOARD_CACHE_KEY = 'dashboardData';

function invalidateDashboard() {
  cacheInvalidate(DASHBOARD_CACHE_KEY);
}

const TASK_UPDATABLE_FIELDS = ['task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder'];

// ── Tasks ──

export async function getAllTasks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const tasks = await getAllTasksOrdered();
  return tasks.map(({ _rowIndex, ...rest }) => rest);
}

export async function createTask(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  try {
    const result = await insertTask({
      projectId: data.projectId,
      task: data.task,
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
    });

    invalidateDashboard();
    return { success: true, task: result };
  } catch (err) {
    console.error("[createTask] error:", err);
    return { error: err.message || "建立任務失敗" };
  }
}

export async function updateTask(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    const sanitized = {};
    for (const key of TASK_UPDATABLE_FIELDS) {
      if (key in data) sanitized[key] = data[key];
    }
    await dalUpdateTask(id, sanitized);
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[updateTask] error:", err);
    return { error: err.message || "更新任務失敗" };
  }
}

export async function deleteTask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  try {
    const taskFiles = await findFilesByTaskId(id);
    for (const f of taskFiles) {
      try { await deleteFromDrive(f.r2Key); } catch (e) { console.error('Drive delete error:', e); }
    }
    await deleteTaskById(id);
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[deleteTask] error:", err);
    return { error: err.message || "刪除任務失敗" };
  }
}

// ── Subtasks ──

export async function getAllSubtasks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const subs = await getAllSubtasksOrdered();
  return subs.map(({ _rowIndex, ...rest }) => rest);
}

export async function createSubtask(data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  try {
    const result = await insertSubtask({
      taskId: data.taskId,
      name: data.name,
      owner: data.owner || null,
      done: data.done || false,
      doneDate: data.doneDate || null,
      notes: data.notes || null,
      sortOrder: data.sortOrder || 0,
    });

    invalidateDashboard();
    return { success: true, subtask: result };
  } catch (err) {
    console.error("[createSubtask] error:", err);
    return { error: err.message || "建立子任務失敗" };
  }
}

export async function updateSubtask(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    await dalUpdateSubtask(id, data);
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[updateSubtask] error:", err);
    return { error: err.message || "更新子任務失敗" };
  }
}

export async function deleteSubtask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    await dalDeleteSubtask(id);
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[deleteSubtask] error:", err);
    return { error: err.message || "刪除子任務失敗" };
  }
}

export async function toggleSubtask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    const sub = await findSubtaskById(id);
    if (!sub) return { error: 'Subtask not found' };

    const newDone = !sub.done;
    await dalUpdateSubtask(id, {
      done: newDone,
      doneDate: newDone ? new Date().toISOString().split('T')[0] : null,
    });

    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[toggleSubtask] error:", err);
    return { error: err.message || "切換子任務狀態失敗" };
  }
}

// ── Links ──

export async function getAllLinks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const links = await getAllLinksOrdered();
  return links.map(({ _rowIndex, ...rest }) => rest);
}

export async function createLink(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  try {
    const result = await insertLink({
      taskId: data.taskId,
      url: data.url,
      title: data.title || null,
      createdBy: session.userId,
    });

    invalidateDashboard();
    return { success: true, link: result };
  } catch (err) {
    console.error("[createLink] error:", err);
    return { error: err.message || "建立連結失敗" };
  }
}

export async function deleteLink(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    await dalDeleteLink(id);
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[deleteLink] error:", err);
    return { error: err.message || "刪除連結失敗" };
  }
}

// ── Files ──

export async function getAllFiles() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const files = await getAllFilesOrdered();
  return files.map(({ _rowIndex, ...rest }) => rest);
}

export async function createFileRecord(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  try {
    const result = await insertFile({
      taskId: data.taskId,
      name: data.name,
      size: data.size || null,
      mimeType: data.mimeType || null,
      r2Key: data.r2Key,
      createdBy: session.userId,
    });

    invalidateDashboard();
    return { success: true, file: result };
  } catch (err) {
    console.error("[createFileRecord] error:", err);
    return { error: err.message || "建立檔案記錄失敗" };
  }
}

export async function deleteFile(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    const file = await findFileById(id);
    if (file) {
      try { await deleteFromDrive(file.r2Key); } catch (e) { console.error('Drive delete error:', e); }
    }
    await deleteFileById(id);
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[deleteFile] error:", err);
    return { error: err.message || "刪除檔案失敗" };
  }
}

// ── Upsert (import) ──

export async function upsertTasks(importedTasks) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  try {
    let updated = 0, inserted = 0;

    const allProjectsList = await getAllProjects();
    const projMap = {};
    allProjectsList.forEach(p => { projMap[p.name] = p.id; });

    for (const t of importedTasks) {
      const projName = (t.project || '').trim();
      if (!projName || !t.task) continue;

      let projectId = projMap[projName];
      if (!projectId) {
        const maxOrder = await getMaxProjectSortOrder();
        const newProj = await insertProject({
          name: projName,
          sortOrder: maxOrder + 1,
          createdBy: session.userId,
        });
        projectId = newProj.id;
        projMap[projName] = projectId;
      }

      const existing = await findTaskByProjectAndName(projectId, t.task);

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

      if (existing) {
        await dalUpdateTask(existing.id, data);
        updated++;
      } else {
        await insertTask({
          projectId,
          task: t.task,
          ...data,
          createdBy: session.userId,
        });
        inserted++;
      }
    }

    invalidateDashboard();
    return { success: true, updated, inserted };
  } catch (err) {
    console.error("[upsertTasks] error:", err);
    return { error: err.message || "匯入任務失敗" };
  }
}

// ── Batch Delete ──

export async function deleteManyTasks(ids) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'No task IDs provided' };

  try {
    let deleted = 0;
    for (const id of ids) {
      const taskFiles = await findFilesByTaskId(id);
      for (const f of taskFiles) {
        try { await deleteFromDrive(f.r2Key); } catch (e) { console.error('Drive delete error:', e); }
      }
      await deleteTaskById(id);
      deleted++;
    }

    invalidateDashboard();
    return { success: true, deleted };
  } catch (err) {
    console.error("[deleteManyTasks] error:", err);
    return { error: err.message || "批次刪除失敗" };
  }
}

// ── Clean All (super_admin only) ──

export async function deleteAllTasks() {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    const allFiles = await getAllFileRows();
    for (const f of allFiles) {
      try { await deleteFromDrive(f.r2Key); } catch (e) { console.error('Drive delete error:', e); }
    }
    await deleteAllTaskRows();
    invalidateDashboard();
    return { success: true };
  } catch (err) {
    console.error("[deleteAllTasks] error:", err);
    return { error: err.message || "清除所有任務失敗" };
  }
}

// ── Dashboard Data (aggregated) ──

export async function getDashboardData() {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  const cached = cacheGet(DASHBOARD_CACHE_KEY);
  if (cached) return cached;

  const [allTasks, allSubtasks, allLinks, allFiles] = await Promise.all([
    getAllTasksOrdered(),
    getAllSubtasksOrdered(),
    getAllLinksOrdered(),
    getAllFilesOrdered(),
  ]);

  const strip = ({ _rowIndex, ...rest }) => rest;
  const result = {
    tasks: allTasks.map(strip),
    subtasks: allSubtasks.map(strip),
    links: allLinks.map(strip),
    files: allFiles.map(strip),
  };

  cacheSet(DASHBOARD_CACHE_KEY, result, 60_000);
  return result;
}
