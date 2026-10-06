import { describe, it, expect } from 'vitest';
import { buildReport, parseArgs, isMissingWatchersColumn } from '../backfill-task-owners.js';

// backfill-task-owners.js 的純邏輯（不連 DB）：新模型（執行人 = 子任務推得、被擠掉的人 → 關注人）的差異計畫
// + dry-run 報表 + 旗標解析 + 「watchers 欄位還不存在」的辨識。預設 dry-run；只有明確的 --apply 才算要寫入。

const tasks = [
  { id: 't1', task: '上架', owner: 'Zed', watchers: null },
  { id: 't2', task: '展覽', owner: null, watchers: null },
  { id: 't3', task: '播出', owner: 'Amy,Bob', watchers: null },
  { id: 't4', task: '手動', owner: 'Manual', watchers: null },
  { id: 't5', task: '樂團', owner: '幸真,Felien', watchers: null },
];
const subs = [
  { taskId: 't1', owner: 'Amy', sortOrder: 1 },
  { taskId: 't1', owner: 'Bob', sortOrder: 2 },
  { taskId: 't2', owner: 'Cat', sortOrder: 1 },
  { taskId: 't3', owner: 'Amy', sortOrder: 1 },
  { taskId: 't3', owner: 'Bob', sortOrder: 2 },
  { taskId: 't4', owner: null, sortOrder: 1 },
  { taskId: 't5', owner: 'Felien', sortOrder: 1 },
];

describe('buildReport', () => {
  it('每個有差異的任務一行「任務: 舊 owner -> 新 owner | watchers: 舊 -> 新」，最後附筆數；無差異的不列', () => {
    const { plan, lines } = buildReport(tasks, subs);
    expect(plan.map(p => p.id)).toEqual(['t1', 't2', 't5']);
    expect(lines).toEqual([
      '上架: Zed -> Amy,Bob,Zed | watchers: (空) -> Zed',
      '展覽: (空) -> Cat | watchers: (空) -> (空)',
      '樂團: 幸真,Felien -> Felien,幸真 | watchers: (空) -> 幸真',
      '共 3 筆任務會調整（其中 2 筆有人被擠掉、會轉成關注人；掃描 5 筆任務）',
    ]);
  });

  it('沒有差異 → 只有 0 筆的摘要', () => {
    const { plan, lines } = buildReport([tasks[2], tasks[3]], subs);
    expect(plan).toEqual([]);
    expect(lines).toEqual(['共 0 筆任務會調整（其中 0 筆有人被擠掉、會轉成關注人；掃描 2 筆任務）']);
  });

  it('watchers 欄位還不存在（資料列沒有 watchers）→ 視同 null，照常出報表', () => {
    const noCol = tasks.map(({ watchers, ...t }) => t);
    expect(buildReport(noCol, subs).plan.map(p => p.id)).toEqual(['t1', 't2', 't5']);
  });

  it('已經套用過（owner 已含關注人且 watchers 已寫入）→ 再跑一次沒有差異（可重複執行）', () => {
    const applied = [{ id: 't5', task: '樂團', owner: 'Felien,幸真', watchers: '幸真' }];
    expect(buildReport(applied, subs).plan).toEqual([]);
  });
});

describe('isMissingWatchersColumn', () => {
  it('辨識 Postgres 的「column watchers does not exist」（含 drizzle 包過的 cause）', () => {
    expect(isMissingWatchersColumn(new Error('column "watchers" does not exist'))).toBe(true);
    const wrapped = new Error('Failed query: select ...');
    wrapped.cause = new Error('column "watchers" does not exist');
    expect(isMissingWatchersColumn(wrapped)).toBe(true);
  });
  it('其他錯誤不算', () => {
    expect(isMissingWatchersColumn(new Error('connection refused'))).toBe(false);
    expect(isMissingWatchersColumn(new Error('column "owner" does not exist'))).toBe(false);
    expect(isMissingWatchersColumn(null)).toBe(false);
  });
});

describe('parseArgs', () => {
  it('預設是 dry-run', () => {
    expect(parseArgs([])).toEqual({ apply: false });
    expect(parseArgs(['--dry-run'])).toEqual({ apply: false });
  });

  it('只有精確的 --apply 才會寫入（近似拼法一律不算）', () => {
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
    expect(parseArgs(['--app'])).toEqual({ apply: false });
    expect(parseArgs(['apply'])).toEqual({ apply: false });
    expect(parseArgs(['--apply=false'])).toEqual({ apply: false });
  });
});
