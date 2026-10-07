import { describe, it, expect } from 'vitest';
import { overallProgress } from '@/lib/v2Overall';

const t = (id, status, startDate, endDate) => ({ id, status, startDate, endDate });

describe('overallProgress（today 由呼叫端傳入）', () => {
  it('沒有任務 → 0', () => { expect(overallProgress([], [], '2026-10-07')).toBe(0); });
  it('已完成 100、子任務看完成率、無子任務看時間進度', () => {
    const tasks = [t('a', '已完成', '2026/09/01', '2026/09/10'), t('b', '進行中', '2026/09/01', '2026/09/30'), t('c', '進行中', '2026/10/01', '2026/10/11')];
    const subs = [{ taskId: 'b', done: true }, { taskId: 'b', done: false }];
    // a=100, b=50, c=(10/07-10/01)/(10/11-10/01)=60 → 70
    expect(overallProgress(tasks, subs, '2026-10-07')).toBe(70);
  });
  it('today 不同 → 時間進度不同（不讀系統時間）', () => {
    const tasks = [t('c', '進行中', '2026/10/01', '2026/10/11')];
    expect(overallProgress(tasks, [], '2026-10-01')).toBe(0);
    expect(overallProgress(tasks, [], '2026-10-06')).toBe(50);
    expect(overallProgress(tasks, [], '2026-10-11')).toBe(100);
  });
});
