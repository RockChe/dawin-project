import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { withRouteCap } from '@/lib/withCap';
// loadScheduleContext 一定要一起 import——漏了它，正確 secret 的測試會炸 ReferenceError
import { shouldRunScheduledBackup, performBackup, loadScheduleContext } from '@/lib/backupRunner';
import { exportAllTables } from '@/lib/backup';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MIN_SECRET_LENGTH = 32;

/**
 * 回傳布林而不是 throw——throw 會變成 500，跟「授權失敗回 401」的契約不一致，
 * 也會把設定錯誤灌進例外監控。設定缺失另由啟動期健康檢查回報。
 */
function cronSecretOk(request) {
  const secret = process.env.CRON_SECRET;
  // 缺失／空字串／過短 → 直接不通過。不組成 "Bearer undefined" 這種可被猜中的字串。
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;

  const authHeader = request.headers.get('authorization') || '';
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(`Bearer ${secret}`);
  if (authBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(authBuf, expectedBuf);
}

// POST — Vercel Cron 觸發。走 CRON_SECRET，不是 session 授權。
export async function POST(request) {
  if (!cronSecretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // 授權通過後才載入設定、判斷要不要跑
  const { settings, lastSuccessAt, keepCount } = await loadScheduleContext();
  const decision = shouldRunScheduledBackup({ settings, lastSuccessAt });
  if (!decision.run) {
    return NextResponse.json({ skipped: true, reason: decision.reason });
  }
  const results = await performBackup({
    targets: settings.backup_targets || [],
    keepCount,
    settings,
  });
  return NextResponse.json(results);
}

// GET — 手動下載整庫備份。原本就是 super_admin only，所以是 manage（不是 export）。
// 它傾印整個資料庫，含 users 表與密碼雜湊——用 export 會讓 admin 也拿得到，是權限放寬。
export const GET = withRouteCap('manage', async () => {
  // 以下與原實作完全相同：pretty-print + 帶時間戳的附件檔名。
  // 不可簡化成 NextResponse.json(data)——那會讓瀏覽器直接顯示 JSON 而非存檔。
  const backupData = await exportAllTables(db);
  const content = JSON.stringify(backupData, null, 2);
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  const fileName = `dawin-backup-${ts}.json`;
  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
