'use server';

import { db } from '@/server/db';
import { configTable as config, backupHistory, auditLog, users } from '@/server/db/schema';
import { eq, inArray, desc, and, or, like, gte, lte } from 'drizzle-orm';
import { withCap } from '@/lib/withCap';
import { encrypt } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import {
  testR2Connection as testR2,
  testGDriveConnection as testGDrive,
} from '@/lib/backup';
import {
  performBackup,
  loadScheduleContext,
  loadBackupConfig,
  BACKUP_CONFIG_KEYS,
  ENCRYPTED_KEYS,
} from '@/lib/backupRunner';

// ── Settings ──

export async function getBackupSettings() {
  return withCap('manage', async () => {
    try {
      const rows = await db.select().from(config).where(inArray(config.key, BACKUP_CONFIG_KEYS));
      const result = loadBackupConfig(rows);
      return { success: true, data: result };
    } catch (err) {
      console.error('[getBackupSettings] error:', err);
      return { error: err.message || '讀取備份設定失敗' };
    }
  });
}

export async function saveBackupSettings(settings) {
  return withCap('manage', async () => {
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
  });
}

// ── History ──

export async function getBackupHistory(limit = 30) {
  return withCap('manage', async () => {
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
  });
}

// ── Audit Log ──

export async function getAuditLogs(filters = {}) {
  return withCap('manage', async () => {
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
  });
}

// ── Connection Tests ──

export async function testR2ConnectionAction(credentials) {
  return withCap('manage', async () => {
    try {
      await testR2(credentials);
      return { success: true };
    } catch (err) {
      console.error('[testR2Connection] error:', err);
      return { error: err.message || 'R2 連線測試失敗' };
    }
  });
}

export async function testGDriveConnectionAction(credentials) {
  return withCap('manage', async () => {
    try {
      await testGDrive(credentials);
      return { success: true };
    } catch (err) {
      console.error('[testGDriveConnection] error:', err);
      return { error: err.message || 'Google Drive 連線測試失敗' };
    }
  });
}

// ── Trigger Backup ──

export async function triggerBackup(targetOverride) {
  return withCap('manage', async (session) => {
    try {
      // 用 backupRunner 的 loadScheduleContext 而不是同模組的 getBackupSettings()——
      // 同模組呼叫走 lexical binding，測試沒辦法用 vi.spyOn 攔截（見 Task 3 的說明）。
      // 讀設定的邏輯本來就該跟授權分開。
      const { settings: s } = await loadScheduleContext();

      // 手動備份：立刻跑，不判 backup_enabled、不判頻率（維持現行語意）
      const targets = targetOverride ? [targetOverride] : (s.backup_targets || []);
      const keepCount = s.backup_keep_count || 30;
      if (targets.length === 0) return { error: '未設定備份目標' };

      const results = await performBackup({ targets, keepCount, settings: s });

      await logAudit('BACKUP_TRIGGER', session.userId, {
        resourceType: 'backup',
        detail: JSON.stringify(results.map(r => `${r.target}:${r.success ? 'ok' : r.error}`)),
      });

      // ⚠️ 回傳形狀不可改：備份頁與既有呼叫端依賴 { success, results }
      return { success: true, results };
    } catch (err) {
      console.error('[triggerBackup] error:', err);
      return { error: err.message || '備份失敗' };
    }
  });
}

// ── Cron Backup (漏洞 A) ──
// cronBackup 已移除：'use server' 檔的每支 export 都會變成可從瀏覽器呼叫的 endpoint，
// 無授權的 export 等於開後門。cron 路徑改由 /api/backup 的 POST 直接呼叫
// backupRunner 的 loadScheduleContext / shouldRunScheduledBackup / performBackup（Task 6）。
