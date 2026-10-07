import { dayIndex } from './dayIndex';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 今天由呼叫端傳入（toBusinessDateString），這裡不取時鐘；任何日期缺值/格式錯 → 0
export function elapsedPct(s, e, today) {
  const S = dayIndex(s), E = dayIndex(e), T = dayIndex(today);
  if (S == null || E == null || T == null) return 0;
  const t = E - S;
  return t > 0 ? clamp(Math.round(((T - S) / t) * 100), 0, 100) : 0;
}

export const gapDays = (gapPts, totalDays) => Math.max(1, Math.round((Math.abs(gapPts) / 100) * totalDays));

export const stateOf = ({ overdue, hold, prop, gap }) =>
  overdue ? 'over' : hold ? 'hold' : prop ? 'prop' : gap <= -5 ? 'behind' : 'ok';

export function gapInfo({ state, done, gap, prog, el, tot }) {
  if (state === 'hold') return { kind: 'hold', text: '暫緩' };
  if (state === 'prop') return { kind: 'prop', text: '提案／待確認' };
  if (done) return { kind: 'done', text: '已完成' };
  const tip = `進度 ${prog}%，今天應有 ${el}%`;
  if (gap <= -5) {
    const n = gapDays(gap, tot);
    return { kind: 'behind', days: n, pts: -gap, text: `落後約 ${n} 天`, sub: `（${-gap} 點）`, tip };
  }
  if (gap >= 5) {
    const n = gapDays(gap, tot);
    return { kind: 'ahead', days: n, pts: gap, text: `領先約 ${n} 天`, sub: `（${gap} 點）`, tip };
  }
  return { kind: 'sync', text: '進度同步' };
}
