import { db } from '@/server/db';
import { auditLog } from '@/server/db/schema';

/**
 * 記錄審計事件
 * @param {string} action - 操作類型 (e.g. 'PASSWORD_RESET', 'PROJECT_DELETE', 'BACKUP_TRIGGER')
 * @param {string} userId - 執行操作的使用者 ID
 * @param {object} [opts] - 選項
 * @param {string} [opts.resourceType] - 資源類型 (e.g. 'user', 'project', 'backup')
 * @param {string} [opts.resourceId] - 資源 ID
 * @param {string} [opts.detail] - 額外描述
 */
export async function logAudit(action, userId, opts = {}) {
  try {
    await db.insert(auditLog).values({
      action,
      userId,
      resourceType: opts.resourceType || null,
      resourceId: opts.resourceId || null,
      detail: opts.detail || null,
    });
  } catch (err) {
    // Audit log 失敗不應阻斷主流程
    console.error('[audit] failed to log:', action, err.message);
  }
}
