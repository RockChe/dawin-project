'use server';

import {
  getAllProjects,
  findProjectById,
  insertProject,
  updateProject as dalUpdateProject,
  deleteProjectById,
  getMaxProjectSortOrder,
  findTasksByProjectId,
  findSubtasksByTaskIds,
  findFilesByTaskId,
} from '@/lib/sheets-dal';
import { safeRequireAuth } from '@/lib/auth';
import { deleteFromDrive } from '@/lib/drive';
import { cacheInvalidate } from '@/lib/cache';

export async function getProjects() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const projects = await getAllProjects();
  return projects.map(({ _rowIndex, ...rest }) => rest);
}

export async function createProject(formData) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  const name = formData.get('name')?.toString().trim();

  if (!name) return { error: '請填寫專案名稱' };

  try {
    const maxOrder = await getMaxProjectSortOrder();
    const nextOrder = maxOrder + 1;

    const result = await insertProject({
      name,
      sortOrder: nextOrder,
      createdBy: session.userId,
    });

    cacheInvalidate('dashboardData');
    return { success: true, project: result };
  } catch (err) {
    console.error('[createProject] error:', err);
    return { error: err.message || '建立專案失敗' };
  }
}

const PROJECT_UPDATABLE_FIELDS = ['name', 'sortOrder'];

export async function updateProject(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    const sanitized = {};
    for (const key of PROJECT_UPDATABLE_FIELDS) {
      if (key in data) sanitized[key] = data[key];
    }
    await dalUpdateProject(id, sanitized);
    cacheInvalidate('dashboardData');
    return { success: true };
  } catch (err) {
    console.error('[updateProject] error:', err);
    return { error: err.message || '更新專案失敗' };
  }
}

export async function deleteProject(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  try {
    // Delete Drive files for all tasks in this project before cascade delete
    const tasks = await findTasksByProjectId(id);
    for (const t of tasks) {
      const files = await findFilesByTaskId(t.id);
      for (const f of files) {
        try { await deleteFromDrive(f.r2Key); } catch (e) { console.error('Drive delete error:', e); }
      }
    }
    await deleteProjectById(id);
    cacheInvalidate('dashboardData');
    return { success: true };
  } catch (err) {
    console.error('[deleteProject] error:', err);
    return { error: err.message || '刪除專案失敗' };
  }
}

export async function getProjectWithTasks(projectId) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const project = await findProjectById(projectId);
  if (!project) return null;

  const projectTasks = await findTasksByProjectId(projectId);
  const taskIds = projectTasks.map(t => t.id);

  let projectSubtasks = [];
  if (taskIds.length > 0) {
    projectSubtasks = await findSubtasksByTaskIds(taskIds);
  }

  // Strip _rowIndex from results
  return {
    project: (({ _rowIndex, ...rest }) => rest)(project),
    tasks: projectTasks.map(({ _rowIndex, ...rest }) => rest),
    subtasks: projectSubtasks.map(({ _rowIndex, ...rest }) => rest),
  };
}
