'use server';

import { db } from '@/server/db';
import { configTable as config, backupHistory, auditLog, users } from '@/server/db/schema';
import { eq, inArray, desc, and, or, like, gte, lte } from 'drizzle-orm';
import { safeRequireAdmin } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import {
  exportAllTables,
  uploadToR2,
  uploadToGoogleDrive,
  cleanupR2Backups,
  cleanupGDriveBackups,
  testR2Connection as testR2,
  testGDriveConnection as testGDrive,
  listBackupsFromR2,
  listBackupsFromGDrive,
} from '@/lib/backup';

// Keys that store encrypted values
const ENCRYPTED_KEYS = ['backup_r2_access_key', 'backup_r2_secret_key', 'backup_gdrive_key'];

// All backup config keys
const BACKUP_CONFIG_KEYS = [
  'backup_r2_account_id', 'backup_r2_access_key', 'backup_r2_secret_key', 'backup_r2_bucket',
  'backup_gdrive_email', 'backup_gdrive_key', 'backup_gdrive_folder',
  'backup_enabled', 'backup_frequency', 'backup_targets', 'backup_keep_count',
];

// ── Internal Helpers ──

/** Parse and decrypt backup config rows into a plain object */
function loadBackupConfig(rows) {
  const result = {};
  for (const row of rows) {
    let value;
    try { value = JSON.parse(row.value); } catch { value = row.value; }
    if (ENCRYPTED_KEYS.includes(row.key) && typeof value === 'string' && value.length > 0) {
      try { result[row.key] = decrypt(value); } catch { result[row.key] = value; }
    } else {
      result[row.key] = value;
    }
  }
  return result;
}

/** Execute backup uploads to specified targets and record history */
async function performBackupToTargets(backupData, targets, keepCount, s) {
  const results = [];

  for (const target of targets) {
    const startTime = Date.now();
    try {
      let uploadResult;

      if (target === 'r2') {
        const creds = {
          accountId: s.backup_r2_account_id,
          accessKey: s.backup_r2_access_key,
          secretKey: s.backup_r2_secret_key,
          bucket: s.backup_r2_bucket,
        };
        if (!creds.accountId || !creds.accessKey || !creds.secretKey || !creds.bucket) {
          throw new Error('R2 憑證未完整設定');
        }
        uploadResult = await uploadToR2(backupData, creds);
        await cleanupR2Backups(creds, keepCount);
      } else if (target === 'gdrive') {
        const creds = {
          email: s.backup_gdrive_email,
          privateKey: s.backup_gdrive_key,
          folderId: s.backup_gdrive_folder,
        };
        if (!creds.email || !creds.privateKey || !creds.folderId) {
          throw new Error('Google Drive 憑證未完整設定');
        }
        uploadResult = await uploadToGoogleDrive(backupData, creds);
        await cleanupGDriveBackups(creds, keepCount);
      } else {
        throw new Error(`未知的備份目標: ${target}`);
      }

      const durationMs = Date.now() - startTime;
      await db.insert(backupHistory).values({
        target,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        status: 'success',
        durationMs,
        tableCounts: JSON.stringify(backupData.meta.counts),
      });

      results.push({ target, success: true, fileName: uploadResult.fileName });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      await db.insert(backupHistory).values({
        target,
        fileName: 'N/A',
        fileSize: 0,
        status: 'failed',
        error: err.message,
        durationMs,
        tableCounts: JSON.stringify(backupData.meta.counts),
      });
      results.push({ target, success: false, error: err.message });
    }
  }

  return results;
}

// ── Settings ──

export async function getBackupSettings() {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    const rows = await db.select().from(config).where(inArray(config.key, BACKUP_CONFIG_KEYS));
    const result = loadBackupConfig(rows);
    return { success: true, data: result };
  } catch (err) {
    console.error('[getBackupSettings] error:', err);
    return { error: err.message || '讀取備份設定失敗' };
  }
}

export async function saveBackupSettings(settings) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    for (const [key, value] of Object.entries(settings)) {
      if (!BACKUP_CONFIG_KEYS.includes(key)) continue;

      let serialized;
      if (ENCRYPTED_KEYS.includes(key) && typeof value === 'string' && value.length > 0) {
        serialized = JSON.stringify(encrypt(value));
      } else {
        serialized = JSON.stringify(value);
      }

      await db.insert(config).values({ key, value: serialized, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: config.key,
          set: { value: serialized, updatedAt: new Date() },
        });
    }

    return { success: true, data: null };
  } catch (err) {
    console.error('[saveBackupSettings] error:', err);
    return { error: err.message || '儲存備份設定失敗' };
  }
}

// ── History ──

export async function getBackupHistory(limit = 30) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    const rows = await db
      .select()
      .from(backupHistory)
      .orderBy(desc(backupHistory.createdAt))
      .limit(limit);

    return { success: true, data: rows };
  } catch (err) {
    console.error('[getBackupHistory] error:', err);
    return { error: err.message || '讀取備份歷史失敗' };
  }
}

// ── Audit Log ──

export async function getAuditLogs(filters = {}) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    const conditions = [];

    if (filters.action) {
      conditions.push(eq(auditLog.action, filters.action));
    }
    if (filters.keyword) {
      const kw = `%${filters.keyword}%`;
      conditions.push(or(like(users.name, kw), like(auditLog.detail, kw)));
    }
    if (filters.dateFrom) {
      conditions.push(gte(auditLog.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      // dateTo 加到當天結束
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLog.createdAt, end));
    }

    let query = db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        userId: auditLog.userId,
        userName: users.name,
        userEmail: users.email,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        detail: auditLog.detail,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rows = await query
      .orderBy(desc(auditLog.createdAt))
      .limit(filters.limit || 100);

    return { success: true, data: rows };
  } catch (err) {
    console.error('[getAuditLogs] error:', err);
    return { error: err.message || '讀取審計記錄失敗' };
  }
}

// ── Connection Tests ──

export async function testR2ConnectionAction(credentials) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    await testR2(credentials);
    return { success: true };
  } catch (err) {
    console.error('[testR2Connection] error:', err);
    return { error: err.message || 'R2 連線測試失敗' };
  }
}

export async function testGDriveConnectionAction(credentials) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    await testGDrive(credentials);
    return { success: true };
  } catch (err) {
    console.error('[testGDriveConnection] error:', err);
    return { error: err.message || 'Google Drive 連線測試失敗' };
  }
}

// ── Trigger Backup ──

export async function triggerBackup(targetOverride) {
  const { session, error } = await safeRequireAdmin();
  if (error) return { error };

  try {
    // Load settings
    const settingsResult = await getBackupSettings();
    if (settingsResult.error) return { error: settingsResult.error };
    const s = settingsResult.data;

    const targets = targetOverride ? [targetOverride] : (s.backup_targets || []);
    const keepCount = s.backup_keep_count || 30;

    if (targets.length === 0) {
      return { error: '未設定備份目標' };
    }

    // Export data and perform backup
    const backupData = await exportAllTables(db);
    const results = await performBackupToTargets(backupData, targets, keepCount, s);

    await logAudit('BACKUP_TRIGGER', session.userId, {
      resourceType: 'backup',
      detail: JSON.stringify(results.map(r => `${r.target}:${r.success ? 'ok' : r.error}`)),
    });

    return { success: true, results };
  } catch (err) {
    console.error('[triggerBackup] error:', err);
    return { error: err.message || '備份失敗' };
  }
}

// ── Cron Backup (called from API route, no session needed) ──

export async function cronBackup() {
  try {
    // Load settings directly (no auth check — cron uses CRON_SECRET)
    const rows = await db.select().from(config).where(inArray(config.key, BACKUP_CONFIG_KEYS));
    const s = loadBackupConfig(rows);

    // Check if backup is enabled
    if (!s.backup_enabled) {
      return { skipped: true, reason: '自動備份未啟用' };
    }

    // Check frequency — skip if too soon
    const frequency = Number(s.backup_frequency) || 8;
    const lastBackup = await db
      .select()
      .from(backupHistory)
      .where(eq(backupHistory.status, 'success'))
      .orderBy(desc(backupHistory.createdAt))
      .limit(1);

    if (lastBackup[0]) {
      const hoursSinceLastBackup = (Date.now() - new Date(lastBackup[0].createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastBackup < frequency) {
        return { skipped: true, reason: `距上次備份僅 ${hoursSinceLastBackup.toFixed(1)} 小時，需 ${frequency} 小時` };
      }
    }

    const targets = s.backup_targets || [];
    const keepCount = s.backup_keep_count || 30;

    if (targets.length === 0) {
      return { skipped: true, reason: '未設定備份目標' };
    }

    // Export data and perform backup
    const backupData = await exportAllTables(db);
    const results = await performBackupToTargets(backupData, targets, keepCount, s);

    // Audit log for cron backup
    await logAudit('BACKUP_CRON', null, {
      resourceType: 'backup',
      detail: JSON.stringify(results.map(r => `${r.target}:${r.success ? 'ok' : r.error}`)),
    });

    return { success: true, results };
  } catch (err) {
    console.error('[cronBackup] error:', err);
    return { error: err.message || 'Cron 備份失敗' };
  }
}
