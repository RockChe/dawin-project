'use server';
import { db } from '@/server/db';
import { userSettings } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';

export async function getUserSettings() {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  try {
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, session.userId));
    const result = {};
    for (const r of rows) { try { result[r.key] = JSON.parse(r.value); } catch { result[r.key] = r.value; } }
    return { success: true, data: result };
  } catch (err) {
    console.error('[getUserSettings] error:', err);
    return { error: err.message || '讀取個人設定失敗' };
  }
}

export async function setUserSetting(key, value) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  try {
    const serialized = JSON.stringify(value);
    const existing = await db.select({ id: userSettings.id }).from(userSettings)
      .where(and(eq(userSettings.userId, session.userId), eq(userSettings.key, key))).limit(1);
    if (existing[0]) {
      await db.update(userSettings).set({ value: serialized, updatedAt: new Date() })
        .where(eq(userSettings.id, existing[0].id));
    } else {
      await db.insert(userSettings).values({ userId: session.userId, key, value: serialized });
    }
    return { success: true };
  } catch (err) {
    console.error('[setUserSetting] error:', err);
    return { error: err.message || '儲存個人設定失敗' };
  }
}
