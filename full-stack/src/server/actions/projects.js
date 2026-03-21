'use server';

import { db } from '@/server/db';
import { projects, tasks, subtasks } from '@/server/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) { return typeof str === 'string' && UUID_RE.test(str); }

export async function getProjects() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  return db.select().from(projects).orderBy(asc(projects.sortOrder), asc(projects.createdAt));
}

export async function createProject(formData) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  const name = formData.get('name')?.toString().trim();

  if (!name) return { error: '請填寫專案名稱' };
  if (name.length > 255) return { error: '專案名稱過長 (上限 255 字元)' };

  try {
    const maxOrder = await db.select({ max: projects.sortOrder }).from(projects);
    const nextOrder = (maxOrder[0]?.max || 0) + 1;

    const result = await db.insert(projects).values({
      name,
      sortOrder: nextOrder,
      createdBy: session.userId,
    }).returning();

    return { success: true, project: result[0] };
  } catch (err) {
    console.error("createProject error:", err);
    return { error: err.message || "建立專案失敗" };
  }
}

export async function updateProject(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid project ID' };

  try {
    await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id));
    return { success: true };
  } catch (err) {
    console.error("updateProject error:", err);
    return { error: err.message || "更新專案失敗" };
  }
}

export async function deleteProject(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid project ID' };

  try {
    await db.delete(projects).where(eq(projects.id, id));
    return { success: true };
  } catch (err) {
    console.error("deleteProject error:", err);
    return { error: err.message || "刪除專案失敗" };
  }
}

export async function getProjectWithTasks(projectId) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(projectId)) return { error: 'Invalid project ID' };

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project[0]) return null;

  const projectTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.sortOrder));

  const taskIds = projectTasks.map(t => t.id);
  let projectSubtasks = [];
  if (taskIds.length > 0) {
    projectSubtasks = await db.select().from(subtasks).where(inArray(subtasks.taskId, taskIds)).orderBy(asc(subtasks.sortOrder));
  }

  return {
    project: project[0],
    tasks: projectTasks,
    subtasks: projectSubtasks,
  };
}
