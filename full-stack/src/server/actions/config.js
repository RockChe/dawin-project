'use server';

import { db } from '@/server/db';
import { configTable as config } from '@/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { withCap } from '@/lib/withCap';

// config 表同時存放備份憑證（backup_*），那些只能經由 backup.js 的 manage 動作存取。
// 這裡明列一般設定的 key，白名單以外一律拒絕——不論讀寫、不論角色。
const PUBLIC_CONFIG_KEYS = ['owners', 'categories'];
const isPublicKey = (k) => PUBLIC_CONFIG_KEYS.includes(k);

export async function getConfig(key) {
  return withCap('read', async () => {
    if (!isPublicKey(key)) return { error: 'FORBIDDEN' };
    const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
    if (!result[0]) return { key, value: null };
    try {
      return { key: result[0].key, value: JSON.parse(result[0].value) };
    } catch {
      return { key: result[0].key, value: result[0].value };
    }
  });
}

export async function getConfigs(keys) {
  return withCap('read', async () => {
    // 空陣列沒有東西可查，且 `[].every(...)` vacuously true 會放行到 inArray(col, [])——
    // drizzle 在部分版本對空陣列會 throw，這裡沒有 try/catch，會變成 digest error。
    if (!Array.isArray(keys) || keys.length === 0) return {};
    // 整批拒絕，不靜默過濾——否則呼叫端會拿到少一半的結果卻不知道。
    if (!keys.every(isPublicKey)) return { error: 'FORBIDDEN' };
    const rows = await db.select().from(config).where(inArray(config.key, keys));
    const result = {};
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value); }
      catch { result[row.key] = row.value; }
    }
    return result;
  });
}

export async function saveConfig(key, value) {
  return withCap('write', async () => {
    if (!isPublicKey(key)) return { error: 'FORBIDDEN' };
    const serialized = JSON.stringify(value);
    const existing = await db.select().from(config).where(eq(config.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(config).set({ value: serialized, updatedAt: new Date() }).where(eq(config.key, key));
    } else {
      await db.insert(config).values({ key, value: serialized });
    }
    return { success: true };
  });
}
