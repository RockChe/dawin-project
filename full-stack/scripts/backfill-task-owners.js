// 一次性回填（關注人模型，docs/design/dawin-dash-task-lead-mockup.html 第 5、6 節）：
// 有子任務 owner 的任務，執行人 = 子任務推得值；原本 owner 裡「會被擠掉」的人轉成該任務的「關注人」(tasks.watchers，
// 接在既有關注人後面)；新 owner = 執行人 ∪ 關注人。
//
//   node scripts/backfill-task-owners.js            # 預設 dry-run：只印出每個差異與筆數，不寫入
//   node scripts/backfill-task-owners.js --apply    # 真的寫入（需 DB_WRITE_CONFIRM=backfill-task-owners@<db-host>，見 _guard.js）
//
// 上線順序：① 先在正式庫跑 migration（新增可為 NULL 的 tasks.watchers）→ ② 本腳本 dry-run、看過、再 --apply → ③ 才部署新版程式。
// 沒有任何子任務 owner 的任務不會動（維持手動 owner）。每筆 UPDATE 都帶「owner / watchers 仍等於剛讀到的舊值」守衛，
// 讀寫之間若有人改過就跳過那筆；全部放進 db.batch（neon-http 沒有互動式 transaction）。可重複執行（已套用的任務不再出現在差異裡）。
// watchers 欄位還不存在：dry-run 以 watchers = null 照常出報表（並提示）；--apply 直接中止、請先跑 migration。
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, isNull } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import * as schema from '../src/server/db/schema.js';
import { assertWriteAllowed } from './_guard.js';
import { planOwnerBackfill } from '../src/lib/taskOwner.js';

// 只有精確的 --apply 才寫入；其他一律 dry-run。
export function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

const show = v => v || '(空)';

export function buildReport(tasks, subtasks) {
  const plan = planOwnerBackfill(tasks, subtasks);
  const demoted = plan.filter(p => (p.toWatchers ?? null) !== (p.fromWatchers ?? null)).length;
  const lines = [
    ...plan.map(p => `${p.task}: ${show(p.from)} -> ${p.to} | watchers: ${show(p.fromWatchers)} -> ${show(p.toWatchers)}`),
    `共 ${plan.length} 筆任務會調整（其中 ${demoted} 筆有人被擠掉、會轉成關注人；掃描 ${tasks.length} 筆任務）`,
  ];
  return { plan, lines };
}

// Postgres 的「column "watchers" does not exist」（drizzle 會把原始錯誤包在 cause 裡）。
export function isMissingWatchersColumn(err) {
  const msgs = [err?.message, err?.cause?.message].filter(Boolean).join(' ');
  return /column "?(tasks\.)?watchers"? does not exist/i.test(msgs);
}

const CHUNK = 100;
const guard = (col, v) => (v == null ? isNull(col) : eq(col, v));

async function main() {
  try { process.loadEnvFile(); } catch { /* 沒有 .env → 用現有環境變數 */ }
  const { apply } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required. Set it in .env file.');
    process.exit(1);
  }
  if (apply) assertWriteAllowed({ operation: 'backfill-task-owners' });

  const db = drizzle(neon(process.env.DATABASE_URL), { schema });
  const { tasks, subtasks } = schema;
  const readTasks = withWatchers => db.select(
    withWatchers
      ? { id: tasks.id, task: tasks.task, owner: tasks.owner, watchers: tasks.watchers }
      : { id: tasks.id, task: tasks.task, owner: tasks.owner },
  ).from(tasks);
  const readSubs = () => db.select({ taskId: subtasks.taskId, owner: subtasks.owner, sortOrder: subtasks.sortOrder, createdAt: subtasks.createdAt }).from(subtasks);

  let taskRows, subRows;
  try {
    [taskRows, subRows] = await Promise.all([readTasks(true), readSubs()]);
  } catch (err) {
    if (!isMissingWatchersColumn(err)) throw err;
    if (apply) {
      console.error('❌ 目標資料庫還沒有 tasks.watchers 欄位，--apply 中止。請先執行 migration（ALTER TABLE "tasks" ADD COLUMN "watchers" varchar(500)）再重跑。');
      process.exit(1);
    }
    console.warn('⚠️ 目標資料庫還沒有 tasks.watchers 欄位：以下預覽把現有關注人視為空。套用前要先執行 migration。\n');
    [taskRows, subRows] = await Promise.all([readTasks(false), readSubs()]);
  }

  const { plan, lines } = buildReport(taskRows, subRows);
  lines.forEach(l => console.log(l));

  if (!apply) {
    console.log('\n(dry-run) 未寫入任何資料。確認後加 --apply 才會寫入。');
    return;
  }
  for (let i = 0; i < plan.length; i += CHUNK) {
    const stmts = plan.slice(i, i + CHUNK).map(p =>
      db.update(tasks).set({ owner: p.to, watchers: p.toWatchers })
        .where(and(eq(tasks.id, p.id), guard(tasks.owner, p.from), guard(tasks.watchers, p.fromWatchers))));
    await db.batch(stmts);
  }
  console.log(`\n✅ 已寫入 ${plan.length} 筆（被讀寫之間改動過的任務會自動略過，可再跑一次 dry-run 確認剩餘差異）`);
}

// 被 import（測試）時不執行；直接 node 執行才跑 main。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
}
