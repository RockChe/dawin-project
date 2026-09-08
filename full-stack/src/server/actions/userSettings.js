'use server';
import { db } from '@/server/db';
import { userSettings } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { withCap } from '@/lib/withCap';

const MAX_SETTING_BYTES = 64 * 1024;

export async function getUserSettings() {
  return withCap('self', async (session) => {
    try {
      const rows = await db.select().from(userSettings).where(eq(userSettings.userId, session.userId));
      const result = {};
      for (const r of rows) { try { result[r.key] = JSON.parse(r.value); } catch (e) { console.warn(`[getUserSettings] JSON parse failed for key "${r.key}":`, e.message); result[r.key] = r.value; } }
      return { success: true, data: result };
    } catch (err) {
      console.error('[getUserSettings] error:', err);
      return { error: err.message || '讀取個人設定失敗' };
    }
  });
}

export async function setUserSetting(key, value) {
  return withCap('self', async (session) => {
    try {
      const serialized = JSON.stringify(value);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_SETTING_BYTES) return { error: '設定值過大' };
      // Single native upsert avoids the SELECT→INSERT/UPDATE TOCTOU race:
      // the (userId, key) unique index guarantees atomicity at the DB level.
      await db.insert(userSettings)
        .values({ userId: session.userId, key, value: serialized })
        .onConflictDoUpdate({
          target: [userSettings.userId, userSettings.key],
          set: { value: serialized, updatedAt: new Date() },
        });
      return { success: true };
    } catch (err) {
      console.error('[setUserSetting] error:', err);
      return { error: err.message || '儲存個人設定失敗' };
    }
  });
}
