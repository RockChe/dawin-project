'use server';

import { db } from '@/server/db';
import { projects, tasks, subtasks } from '@/server/db/schema';
import { eq, asc, inArray, sql } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';
import { isValidUUID } from '@/lib/utils';
import { deleteFromR2 } from '@/lib/r2';
import { logAudit } from '@/lib/audit';

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
    const proj = await db.select({ createdBy: projects.createdBy, bannerR2Key: projects.bannerR2Key }).from(projects).where(eq(projects.id, id)).limit(1);
    if (!proj[0]) return { error: '專案不存在' };
    if (proj[0].createdBy !== session.userId && session.role !== 'super_admin') {
      return { error: '無權限刪除此專案' };
    }

    // Clean up banner from R2
    if (proj[0].bannerR2Key) {
      try { await deleteFromR2(proj[0].bannerR2Key); } catch (err) {
        console.error('[deleteProject] banner cleanup:', err);
      }
    }

    await db.delete(projects).where(eq(projects.id, id));

    await logAudit('PROJECT_DELETE', session.userId, {
      resourceType: 'project',
      resourceId: id,
    });

    return { success: true };
  } catch (err) {
    console.error("deleteProject error:", err);
    return { error: err.message || "刪除專案失敗" };
  }
}

export async function deleteProjectBanner(projectId) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  if (!isValidUUID(projectId)) return { error: 'Invalid project ID' };

  try {
    const proj = await db.select({ bannerR2Key: projects.bannerR2Key, createdBy: projects.createdBy })
      .from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj[0]) return { error: '專案不存在' };
    if (proj[0].createdBy !== session.userId && session.role !== 'super_admin') {
      return { error: '無權限修改此專案' };
    }

    if (proj[0].bannerR2Key) {
      try { await deleteFromR2(proj[0].bannerR2Key); } catch (err) {
        console.error('[deleteProjectBanner] R2 cleanup:', err);
      }
    }

    await db.update(projects).set({ bannerR2Key: null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    return { success: true };
  } catch (err) {
    console.error("[deleteProjectBanner] error:", err);
    return { error: err.message || "刪除 Banner 失敗" };
  }
}

export async function reorderProjects(orderedIds) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  if (!Array.isArray(orderedIds) || !orderedIds.every(isValidUUID)) return { error: 'Invalid project IDs' };
  try {
    // Verify ownership: user must own all projects or be super_admin
    if (session.role !== 'super_admin') {
      const projs = await db.select({ id: projects.id, createdBy: projects.createdBy })
        .from(projects).where(inArray(projects.id, orderedIds));
      const unauthorized = projs.filter(p => p.createdBy !== session.userId);
      if (unauthorized.length > 0) {
        return { error: '無權限修改某些專案的排序' };
      }
    }

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
