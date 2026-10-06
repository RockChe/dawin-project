// 一次性回填：把 tasks.owner 改成「由底下子任務 owner 自動帶出」的值（decision-task-owner-model 方案 A）。
//
//   node scripts/backfill-task-owners.js            # 預設 dry-run：只印出每個差異 `任務名稱: 舊 -> 新` 與筆數，不寫入
//   node scripts/backfill-task-owners.js --apply    # 真的寫入（需 DB_WRITE_CONFIRM=backfill-task-owners@<db-host>，見 _guard.js）
//
// 沒有任何子任務 owner 的任務不會動（維持手動 owner）。每筆 UPDATE 都帶「owner 仍等於剛讀到的舊值」守衛，
// 讀寫之間若有人改過就跳過那筆；全部放進 db.batch（neon-http 沒有互動式 transaction）。
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

export function buildReport(tasks, subtasks) {
  const plan = planOwnerBackfill(tasks, subtasks);
  const lines = [
    ...plan.map(p => `${p.task}: ${p.from || '(空)'} -> ${p.to}`),
    `共 ${plan.length} 筆任務的負責人會被改成由子任務帶出的值（掃描 ${tasks.length} 筆任務）`,
  ];
  return { plan, lines };
}

const CHUNK = 100;

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
  const [taskRows, subRows] = await Promise.all([
    db.select({ id: tasks.id, task: tasks.task, owner: tasks.owner }).from(tasks),
    db.select({ taskId: subtasks.taskId, owner: subtasks.owner, sortOrder: subtasks.sortOrder, createdAt: subtasks.createdAt }).from(subtasks),
  ]);

  const { plan, lines } = buildReport(taskRows, subRows);
  lines.forEach(l => console.log(l));

  if (!apply) {
    console.log('\n(dry-run) 未寫入任何資料。確認後加 --apply 才會寫入。');
    return;
  }
  for (let i = 0; i < plan.length; i += CHUNK) {
    const stmts = plan.slice(i, i + CHUNK).map(p =>
      db.update(tasks).set({ owner: p.to })
        .where(and(eq(tasks.id, p.id), p.from == null ? isNull(tasks.owner) : eq(tasks.owner, p.from))));
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
