import { dayIndex } from './dayIndex';
import { gapDays } from './timelineGap';

// 畫面標籤與雲朵對照（key 內部使用，畫面只出現 label）
const MAP = {
  over: { label: '有逾期', cloud: 'dark' },
  ahead: { label: '進度領先', cloud: 'nimbus' },
  ok: { label: '進行順利', cloud: 'white' },
  hold: { label: '暫緩中', cloud: 'purple' },
  prop: { label: '提案／待確認', cloud: 'pink' },
};

// tasks: [{status, end}]；range: {s,e}；today 由呼叫端傳入；avg＝專案平均進度、el＝專案已過時間百分比
export function projectStatus({ tasks = [], range, today, avg, el }) {
  const out = (key, text) => ({ key, ...MAP[key], text });
  const T = dayIndex(today);
  const late = tasks.filter((t) => {
    const e = dayIndex(t.end);
    return t.status !== '已完成' && e != null && T != null && e < T;
  });
  const gap = avg - el;
  const S = dayIndex(range?.s), E = dayIndex(range?.e);
  const n = gapDays(gap, S != null && E != null ? E - S : 0);
  const behind = gap <= -5;

  if (late.length) {
    const maxDays = Math.max(...late.map((t) => T - dayIndex(t.end)));
    return out('over', `有 ${late.length} 件逾期，最久 ${maxDays} 天${behind ? `；整體進度落後約 ${n} 天（${-gap} 點）` : ''}`);
  }
  if (tasks.length && tasks.every((t) => t.status === '暫緩')) return out('hold', '全部暫緩中');
  if (!tasks.some((t) => t.status === '進行中' || t.status === '已完成')) return out('prop', '提案／待確認階段，尚未開工');
  if (avg >= 85) return out('ahead', `進度 ${avg}%，接近完成`);
  if (gap >= 25) return out('ahead', `進度 ${avg}%，領先約 ${n} 天（${gap} 點）`);
  return out('ok', behind ? `沒有逾期，但進度落後約 ${n} 天（${-gap} 點）` : `進行順利，沒有逾期（進度 ${avg}%）`);
}
