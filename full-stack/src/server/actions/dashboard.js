'use server';

import { db } from '@/server/db';
import { tasks, subtasks, links, files, projects, users, configTable as config } from '@/server/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/r2';

/**
 * Consolidated initial data loader — 1 auth check + 6 parallel queries.
 * Replaces getDashboardData() + getProjects() + getConfigs() + getSessionInfo().
 */
export async function getInitialData() {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };

  const [allTasks, allSubtasks, allLinks, allFiles, allProjects, configRows, allUsers] = await Promise.all([
    db.select().from(tasks).orderBy(asc(tasks.sortOrder)),
    db.select().from(subtasks).orderBy(asc(subtasks.sortOrder)),
    db.select().from(links).orderBy(desc(links.createdAt)),
    db.select().from(files).orderBy(desc(files.createdAt)),
    db.select().from(projects).orderBy(asc(projects.sortOrder), asc(projects.createdAt)),
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
  const projectsWithBanners = await Promise.all(
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
