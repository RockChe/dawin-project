// Fail-closed guard for scripts/ that write to the production database.
//
// A bare boolean flag (e.g. ALLOW_PROD_WRITE=true) isn't enough: it can
// linger in a shell profile or .env and silently authorize a script the
// operator never meant to run, against whatever DATABASE_URL happens to be
// set at the time. To close that gap, the confirmation value must bind BOTH
// the operation being run AND the resolved DATABASE_URL host:
//
//   DB_WRITE_CONFIRM=<operation>@<db-host>
//
// A leftover value from a previous `seed` run can't authorize `restore`,
// and a value copied for the prod host can't authorize a run against a
// different (e.g. dev/staging) host — the check fails closed either way.
export function assertWriteAllowed({ operation }) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ 拒絕寫入：DATABASE_URL 未設定，無法確認寫入目標。');
    process.exit(1);
    return;
  }

  let host;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    console.error('❌ 拒絕寫入：DATABASE_URL 格式無法解析，無法確認寫入目標。');
    process.exit(1);
    return;
  }

  const expected = `${operation}@${host}`;
  const actual = process.env.DB_WRITE_CONFIRM;

  if (actual !== expected) {
    console.error(`❌ 拒絕寫入：此操作（${operation}）將對資料庫主機「${host}」執行寫入，但未取得確認。`);
    console.error('   這是刻意加上的安全防護，避免手滑對正式環境寫入。');
    console.error(`   若確認要執行，請設定環境變數後再跑一次：`);
    console.error(`     DB_WRITE_CONFIRM=${expected}`);
    process.exit(1);
    return;
  }
}
