import { describe, it, expect } from 'vitest';
import { projectStatus } from '@/lib/projectWeather';

const T = (status, end) => ({ status, end });
const R = { s: '2026/09/01', e: '2026/12/31' }; // 121 天
const run = (tasks, avg, el, today = '2026/10/07') => projectStatus({ tasks, range: R, today, avg, el });

describe('projectStatus 判斷順序', () => {
  it('逾期優先於領先', () => expect(run([T('進行中', '2026/10/01')], 90, 10).key).toBe('over'));
  it('逾期優先於全暫緩以外的狀態', () => expect(run([T('暫緩', '2026/10/01')], 0, 30).key).toBe('over'));
  it('全暫緩', () => expect(run([T('暫緩', '2026/11/01')], 0, 30).key).toBe('hold'));
  it('全提案', () => expect(run([T('提案中', '2026/11/01'), T('待確認', '2026/11/02')], 0, 30).key).toBe('prop'));
  it('提案混暫緩（無進行中／已完成）→ prop', () =>
    expect(run([T('暫緩', '2026/11/01'), T('提案中', '2026/11/02')], 0, 30).key).toBe('prop'));
  it('空 tasks → prop', () => expect(run([], 0, 0).key).toBe('prop'));
  it('只有待辦 → prop', () => expect(run([T('待辦', '2026/11/01')], 0, 30).key).toBe('prop'));
  it('avg=85 → 領先', () => expect(run([T('進行中', '2026/12/01')], 85, 80).key).toBe('ahead'));
  it('avg=84 且領先不足 → ok', () => expect(run([T('進行中', '2026/12/01')], 84, 80).key).toBe('ok'));
  it('領先 25 點 → ahead', () => expect(run([T('進行中', '2026/12/01')], 60, 35).key).toBe('ahead'));
  it('領先 24 點 → ok', () => expect(run([T('進行中', '2026/12/01')], 59, 35).key).toBe('ok'));
  it('已完成不算逾期', () =>
    expect(run([T('已完成', '2026/10/01'), T('進行中', '2026/12/01')], 50, 50).key).toBe('ok'));
  it('end 剛好是今天不算逾期', () => expect(run([T('進行中', '2026/10/07')], 50, 50).key).toBe('ok'));
  it('end 缺值不算逾期', () => expect(run([T('進行中', null)], 50, 50).key).toBe('ok'));
  it('ISO 與斜線混用', () => expect(run([T('進行中', '2026-10-01')], 50, 50, '2026-10-07').key).toBe('over'));
});

describe('projectStatus 輸出對照', () => {
  it('over → 有逾期／dark', () =>
    expect(run([T('進行中', '2026/10/01')], 50, 50)).toMatchObject({ key: 'over', label: '有逾期', cloud: 'dark' }));
  it('ahead → 進度領先／nimbus', () =>
    expect(run([T('進行中', '2026/12/01')], 90, 50)).toMatchObject({ key: 'ahead', label: '進度領先', cloud: 'nimbus' }));
  it('ok → 進行順利／white', () =>
    expect(run([T('進行中', '2026/12/01')], 50, 50)).toMatchObject({ key: 'ok', label: '進行順利', cloud: 'white' }));
  it('hold → 暫緩中／purple', () =>
    expect(run([T('暫緩', '2026/12/01')], 0, 0)).toMatchObject({ key: 'hold', label: '暫緩中', cloud: 'purple' }));
  it('prop → 提案／待確認／pink', () =>
    expect(run([T('提案中', '2026/12/01')], 0, 0)).toMatchObject({ key: 'prop', label: '提案／待確認', cloud: 'pink' }));
});

describe('projectStatus 文案', () => {
  it('逾期文案含件數與最久天數', () => {
    const r = run([T('進行中', '2026/10/01'), T('待辦', '2026/10/05')], 40, 40);
    expect(r.text).toMatch(/有 2 件逾期/);
    expect(r.text).toMatch(/最久 6 天/);
  });
  it('逾期且落後 18 點（121 天）→ 文案含「落後約 22 天」', () => {
    const r = run([T('進行中', '2026/10/01')], 32, 50);
    expect(r.key).toBe('over');
    expect(r.text).toContain('落後約 22 天（18 點）');
  });
  it('逾期但沒落後 → 不含落後', () =>
    expect(run([T('進行中', '2026/10/01')], 50, 50).text).not.toContain('落後'));
  it('ok 但落後 18 點 → 「沒有逾期，但進度落後約 22 天」', () =>
    expect(run([T('進行中', '2026/12/01')], 32, 50).text).toBe('沒有逾期，但進度落後約 22 天（18 點）'));
  it('ok 且同步 → 「進行順利，沒有逾期」', () =>
    expect(run([T('進行中', '2026/12/01')], 50, 50).text).toBe('進行順利，沒有逾期（進度 50%）'));
  it('avg ≥ 85 → 接近完成', () =>
    expect(run([T('進行中', '2026/12/01')], 90, 80).text).toBe('進度 90%，接近完成'));
  it('領先文案含約 N 天', () =>
    expect(run([T('進行中', '2026/12/01')], 60, 35).text).toBe('進度 60%，領先約 30 天（25 點）'));
  it('全暫緩文案', () => expect(run([T('暫緩', '2026/12/01')], 0, 0).text).toBe('全部暫緩中'));
  it('提案文案', () => expect(run([], 0, 0).text).toBe('提案／待確認階段，尚未開工'));
});
