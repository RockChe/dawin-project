'use server';

import { db } from '@/server/db';
import { config } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeRequireAuth } from '@/lib/auth';

export async function getConfig(key) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
  if (!result[0]) return { key, value: null };

  try {
    return { key: result[0].key, value: JSON.parse(result[0].value) };
  } catch {
    return { key: result[0].key, value: result[0].value };
  }
}

export async function saveConfig(key, value) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  const serialized = JSON.stringify(value);
  const existing = await db.select().from(config).where(eq(config.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(config).set({ value: serialized, updatedAt: new Date() }).where(eq(config.key, key));
  } else {
    await db.insert(config).values({ key, value: serialized });
  }

  return { success: true };
}
