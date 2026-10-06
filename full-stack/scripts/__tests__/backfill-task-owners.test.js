import { describe, it, expect } from 'vitest';
import { buildReport, parseArgs } from '../backfill-task-owners.js';

// backfill-task-owners.js 的純邏輯（不連 DB）：推得 owner 的差異計畫 + dry-run 報表 + 旗標解析。
// 預設 dry-run；只有明確的 --apply 才算要寫入。

const tasks = [
  { id: 't1', task: '上架', owner: 'Zed' },
  { id: 't2', task: '展覽', owner: null },
  { id: 't3', task: '播出', owner: 'Amy,Bob' },
  { id: 't4', task: '手動', owner: 'Manual' },
];
const subs = [
  { taskId: 't1', owner: 'Amy', sortOrder: 1 },
  { taskId: 't1', owner: 'Bob', sortOrder: 2 },
  { taskId: 't2', owner: 'Cat', sortOrder: 1 },
  { taskId: 't3', owner: 'Amy', sortOrder: 1 },
  { taskId: 't3', owner: 'Bob', sortOrder: 2 },
  { taskId: 't4', owner: null, sortOrder: 1 },
];

describe('buildReport', () => {
  it('每個有差異的任務一行「任務名稱: 舊 -> 新」，最後附筆數；無差異的不列', () => {
    const { plan, lines } = buildReport(tasks, subs);
    expect(plan.map(p => p.id)).toEqual(['t1', 't2']);
    expect(lines).toEqual([
      '上架: Zed -> Amy,Bob',
      '展覽: (空) -> Cat',
      '共 2 筆任務的負責人會被改成由子任務帶出的值（掃描 4 筆任務）',
    ]);
  });

  it('沒有差異 → 只有 0 筆的摘要', () => {
    const { plan, lines } = buildReport([tasks[2], tasks[3]], subs);
    expect(plan).toEqual([]);
    expect(lines).toEqual(['共 0 筆任務的負責人會被改成由子任務帶出的值（掃描 2 筆任務）']);
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
