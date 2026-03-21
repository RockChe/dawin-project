'use server';

import { db } from '@/server/db';
import { projects, tasks, subtasks } from '@/server/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';

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

  const maxOrder = await db.select({ max: projects.sortOrder }).from(projects);
  const nextOrder = (maxOrder[0]?.max || 0) + 1;

  const result = await db.insert(projects).values({
    name,
    sortOrder: nextOrder,
    createdBy: session.userId,
  }).returning();

  return { success: true, project: result[0] };
}

export async function updateProject(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id));
  return { success: true };
}

export async function deleteProject(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  await db.delete(projects).where(eq(projects.id, id));
  return { success: true };
}

export async function getProjectWithTasks(projectId) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
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
