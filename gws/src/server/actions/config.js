'use server';

import { getConfigByKey, getConfigsByKeys, upsertConfig } from '@/lib/sheets-dal';
import { safeRequireAuth } from '@/lib/auth';

export async function getConfig(key) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  const row = await getConfigByKey(key);
  if (!row) return { key, value: null };

  try {
    return { key: row.key, value: JSON.parse(row.value) };
  } catch {
    return { key: row.key, value: row.value };
  }
}

export async function getConfigs(keys) {
  const { error } = await safeRequireAuth();
  if (error) return { error };

  const rows = await getConfigsByKeys(keys);
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); }
    catch { result[row.key] = row.value; }
  }
  return result;
}

export async function saveConfig(key, value) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  if (!session.role || !['admin', 'super_admin'].includes(session.role)) {
    return { error: 'FORBIDDEN' };
  }

  try {
    const serialized = JSON.stringify(value);
    await upsertConfig(key, serialized);
    return { success: true };
  } catch (err) {
    console.error('[saveConfig] error:', err);
    return { error: err.message || '儲存設定失敗' };
  }
}
