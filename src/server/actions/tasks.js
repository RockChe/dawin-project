'use server';

import { db } from '@/server/db';
import { tasks, subtasks, links, files } from '@/server/db/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2';

// ── Tasks ──

export async function getAllTasks() {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  return db.select().from(tasks).orderBy(asc(tasks.sortOrder));
}

export async function createTask(data) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  const result = await db.insert(tasks).values({
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
  }).returning();

  return { success: true, task: result[0] };
}

export async function updateTask(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const updateData = { ...data, updatedAt: new Date() };
  await db.update(tasks).set(updateData).where(eq(tasks.id, id));
  return { success: true };
}

export async function deleteTask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  // Delete associated R2 files first
  const taskFiles = await db.select().from(files).where(eq(files.taskId, id));
  for (const f of taskFiles) {
    try { await deleteFromR2(f.r2Key); } catch (e) { console.error('R2 delete error:', e); }
  }

  await db.delete(tasks).where(eq(tasks.id, id));
  return { success: true };
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

  const result = await db.insert(subtasks).values({
    taskId: data.taskId,
    name: data.name,
    owner: data.owner || null,
    done: data.done || false,
    doneDate: data.doneDate || null,
    notes: data.notes || null,
    sortOrder: data.sortOrder || 0,
  }).returning();

  return { success: true, subtask: result[0] };
}

export async function updateSubtask(id, data) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  await db.update(subtasks).set(data).where(eq(subtasks.id, id));
  return { success: true };
}

export async function deleteSubtask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  await db.delete(subtasks).where(eq(subtasks.id, id));
  return { success: true };
}

export async function toggleSubtask(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const result = await db.select().from(subtasks).where(eq(subtasks.id, id)).limit(1);
  if (!result[0]) return { error: 'Subtask not found' };

  const sub = result[0];
  const newDone = !sub.done;

  await db.update(subtasks).set({
    done: newDone,
    doneDate: newDone ? new Date().toISOString().split('T')[0] : null,
  }).where(eq(subtasks.id, id));

  return { success: true };
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

  const result = await db.insert(links).values({
    taskId: data.taskId,
    url: data.url,
    title: data.title || null,
    createdBy: session.userId,
  }).returning();

  return { success: true, link: result[0] };
}

export async function deleteLink(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  await db.delete(links).where(eq(links.id, id));
  return { success: true };
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

  const result = await db.insert(files).values({
    taskId: data.taskId,
    name: data.name,
    size: data.size || null,
    mimeType: data.mimeType || null,
    r2Key: data.r2Key,
    createdBy: session.userId,
  }).returning();

  return { success: true, file: result[0] };
}

export async function deleteFile(id) {
  const { error } = await safeRequireAuth();
  if (error) return { error };
  const result = await db.select().from(files).where(eq(files.id, id)).limit(1);
  if (result[0]) {
    try { await deleteFromR2(result[0].r2Key); } catch (e) { console.error('R2 delete error:', e); }
  }
  await db.delete(files).where(eq(files.id, id));
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
