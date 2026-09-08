// 備份的實際執行核心。刻意「不是」server action、「不做授權」——
// 授權由兩個入口各自負責：
//   1. src/server/actions/backup.js 的 triggerBackup → withCap('manage')
//   2. src/app/api/backup/route.js 的 POST → CRON_SECRET
// 這一行讓誤把它 import 進 client bundle 時 build 直接失敗。
import 'server-only';

import { db } from '@/server/db';
import { configTable as config, backupHistory } from '@/server/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import {
  exportAllTables,
  uploadToR2,
  uploadToGoogleDrive,
  cleanupR2Backups,
  cleanupGDriveBackups,
} from '@/lib/backup';

const DEFAULT_FREQUENCY_HOURS = 8;

// Keys that store encrypted values
export const ENCRYPTED_KEYS = ['backup_r2_access_key', 'backup_r2_secret_key', 'backup_gdrive_key'];

// All backup config keys
export const BACKUP_CONFIG_KEYS = [
  'backup_r2_account_id', 'backup_r2_access_key', 'backup_r2_secret_key', 'backup_r2_bucket',
  'backup_gdrive_email', 'backup_gdrive_key', 'backup_gdrive_folder',
  'backup_enabled', 'backup_frequency', 'backup_targets', 'backup_keep_count',
];

/** Parse and decrypt backup config rows into a plain object */
export function loadBackupConfig(rows) {
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

/**
 * cron 專用的跳過判斷。純函式，不碰 DB。
 * 手動備份「不」走這裡——管理員按下去就該立刻跑。
 */
export function shouldRunScheduledBackup({ settings, lastSuccessAt, now = new Date() }) {
  if (!settings?.backup_enabled) return { run: false, reason: '自動備份未啟用' };

  const targets = settings.backup_targets || [];
  if (targets.length === 0) return { run: false, reason: '未設定備份目標' };

  if (lastSuccessAt) {
    const frequency = Number(settings.backup_frequency) || DEFAULT_FREQUENCY_HOURS;
    const hoursSince = (now.getTime() - new Date(lastSuccessAt).getTime()) / 3600_000;
    if (hoursSince < frequency) {
      return { run: false, reason: `距上次備份僅 ${hoursSince.toFixed(1)} 小時，需 ${frequency} 小時` };
    }
  }
  return { run: true };
}

/**
 * 讀出 cron 需要的排程脈絡。從原 cronBackup 的前半段照搬。
 * Task 6 的 route POST 會用到——記得 export 也記得在 route 裡 import。
 */
export async function loadScheduleContext() {
  const rows = await db.select().from(config).where(inArray(config.key, BACKUP_CONFIG_KEYS));
  const settings = loadBackupConfig(rows);

  const last = await db.select().from(backupHistory)
    .where(eq(backupHistory.status, 'success'))
    .orderBy(desc(backupHistory.createdAt))
    .limit(1);

  return {
    settings,
    lastSuccessAt: last[0]?.createdAt ?? null,
    keepCount: settings.backup_keep_count || 30,
  };
}

/** 實際執行備份與上傳。呼叫端必須已經完成授權。 */
export async function performBackup({ targets, keepCount, settings }) {
  const backupData = await exportAllTables(db);
  return performBackupToTargets(backupData, targets, keepCount, settings);
}
