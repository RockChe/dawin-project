'use server';

import { db } from '@/server/db';
import { projects, tasks, subtasks } from '@/server/db/schema';
import { eq, asc, inArray, sql } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';
import { isValidUUID } from '@/lib/utils';

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
    const result = await db.insert(projects).values({
      name,
      sortOrder: sql`COALESCE((SELECT MAX(sort_order) FROM projects), 0) + 1`,
      createdBy: session.userId,
    }).returning();

    return { success: true, project: result[0] };
  } catch (err) {
    console.error("createProject error:", err);
    return { error: err.message || "建立專案失敗" };
  }
}

export async function updateProject(id, data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid project ID' };

  try {
    // Ownership check: only creator or super_admin can update
    const proj = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, id)).limit(1);
    if (!proj[0]) return { error: '專案不存在' };
    if (proj[0].createdBy !== session.userId && session.role !== 'super_admin') {
      return { error: '無權限修改此專案' };
    }

    // Whitelist allowed fields
    const ALLOWED = ['name', 'sortOrder'];
    const updateData = { updatedAt: new Date() };
    for (const key of ALLOWED) {
      if (key in data) updateData[key] = data[key];
    }

    await db.update(projects).set(updateData).where(eq(projects.id, id));
    return { success: true };
  } catch (err) {
    console.error("updateProject error:", err);
    return { error: err.message || "更新專案失敗" };
  }
}

export async function deleteProject(id) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(id)) return { error: 'Invalid project ID' };

  try {
    // Ownership check: only creator or super_admin can delete
    const proj = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, id)).limit(1);
    if (!proj[0]) return { error: '專案不存在' };
    if (proj[0].createdBy !== session.userId && session.role !== 'super_admin') {
      return { error: '無權限刪除此專案' };
    }

    await db.delete(projects).where(eq(projects.id, id));
    return { success: true };
  } catch (err) {
    console.error("deleteProject error:", err);
    return { error: err.message || "刪除專案失敗" };
  }
}

export async function reorderProjects(orderedIds) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  if (!Array.isArray(orderedIds) || !orderedIds.every(isValidUUID)) return { error: 'Invalid project IDs' };
  try {
    await Promise.all(
      orderedIds.map((id, i) =>
        db.update(projects).set({ sortOrder: i + 1, updatedAt: new Date() }).where(eq(projects.id, id))
      )
    );
    return { success: true };
  } catch (err) {
    console.error("[reorderProjects] error:", err);
    return { error: err.message || "重新排序失敗" };
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
