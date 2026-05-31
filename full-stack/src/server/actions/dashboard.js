'use server';

import { db } from '@/server/db';
import { tasks, subtasks, links, files, projects, users, configTable as config } from '@/server/db/schema';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/r2';
import { alias } from 'drizzle-orm/pg-core';

/**
 * Consolidated initial data loader — 1 auth check + 6 parallel queries.
 * Replaces getDashboardData() + getProjects() + getConfigs() + getSessionInfo().
 */
export async function getInitialData() {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  const taskCreator = alias(users, 'taskCreator');
  const projCreator = alias(users, 'projCreator');

  const [allTasks, allSubtasks, allLinks, allFiles, allProjects, configRows, allUsers] = await Promise.all([
    db.select({
      id: tasks.id, projectId: tasks.projectId, task: tasks.task,
      status: tasks.status, category: tasks.category,
      startDate: tasks.startDate, endDate: tasks.endDate,
      duration: tasks.duration, owner: tasks.owner,
      priority: tasks.priority, notes: tasks.notes,
      sortOrder: tasks.sortOrder, source: tasks.source,
      createdBy: tasks.createdBy, createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt, creatorName: taskCreator.name,
    }).from(tasks).leftJoin(taskCreator, eq(tasks.createdBy, taskCreator.id))
      .orderBy(asc(tasks.sortOrder)),
    db.select().from(subtasks).orderBy(asc(subtasks.sortOrder)),
    db.select({
      id: links.id, taskId: links.taskId, url: links.url,
      title: links.title, createdBy: links.createdBy, createdAt: links.createdAt,
    }).from(links).orderBy(desc(links.createdAt)),
    db.select({
      id: files.id, taskId: files.taskId, name: files.name,
      size: files.size, mimeType: files.mimeType, r2Key: files.r2Key,
      createdBy: files.createdBy, createdAt: files.createdAt,
    }).from(files).orderBy(desc(files.createdAt)),
    db.select({
      id: projects.id, name: projects.name, bannerR2Key: projects.bannerR2Key,
      sortOrder: projects.sortOrder, source: projects.source,
      createdBy: projects.createdBy, createdAt: projects.createdAt,
      updatedAt: projects.updatedAt, creatorName: projCreator.name,
    }).from(projects).leftJoin(projCreator, eq(projects.createdBy, projCreator.id))
      .orderBy(asc(projects.sortOrder), asc(projects.createdAt)),
    db.select().from(config).where(inArray(config.key, ['categories'])),
    db.select({ name: users.name }).from(users),
  ]);

  const userNames = allUsers.map(u => u.name);

  const configs = {};
  for (const row of configRows) {
    try { configs[row.key] = JSON.parse(row.value); }
    catch { configs[row.key] = row.value; }
  }

  // Resolve banner URLs server-side
  let projectsWithBanners;
  if (process.env.R2_PUBLIC_URL) {
    // Sync path — no async overhead
    projectsWithBanners = allProjects.map(p =>
      p.bannerR2Key ? { ...p, bannerUrl: `${process.env.R2_PUBLIC_URL}/${p.bannerR2Key}` } : p
    );
  } else {
    // Fallback: generate presigned URLs
    projectsWithBanners = await Promise.all(
      allProjects.map(async (p) => {
        if (p.bannerR2Key) {
          try {
            const bannerUrl = await getDownloadUrl(p.bannerR2Key);
            return { ...p, bannerUrl };
          } catch { return p; }
        }
        return p;
      })
    );
  }

  return {
    tasks: allTasks,
    subtasks: allSubtasks,
    links: allLinks,
    files: allFiles,
    projects: projectsWithBanners,
    configs,
    userNames,
    session: { role: session.role, name: session.name, email: session.email },
  };
}
