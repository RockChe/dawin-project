import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import SegBar from '@/components/v2/SegBar';
import { timeAxis } from '@/lib/v2Axis';

const TODAY = '2026/10/07';
const ax = timeAxis('月', TODAY); // 左界 2026/06/01
const mk = (s, e) => ({ kind: 'p', name: 'P', s, e, prog: 40, el: 40, state: 'ok', done: false, gapInfo: { kind: 'sync', text: '進度同步', tip: '' } });
const dl = (c) => c.querySelector('.dl.ls');

const renderBar = (row) => render(<CloudLevelProvider level="full"><div className="in"><SegBar row={row} ax={ax} today={TODAY} ends /></div></CloudLevelProvider>).container;

describe('SegBar：起點早於時間軸最左（cl0）時的起點標籤', () => {
  it('標籤文字完整（跨年 YYYY/MM/DD，帶 ◂），並放進條內左端：不往左溢出軌道', () => {
    const c = renderBar(mk('2025/11/10', '2026/12/20'));
    const el = dl(c);
    expect(el.textContent).toBe('◂ 2025/11/10');
    expect(c.querySelector('.hb').className).toContain('cl0');
    expect(el.className).toContain('in-bar'); // CSS 不套 translateX(-100%)
    // left 不得是「0% - 8px」這種往左溢出的負值
    expect(el.style.left).not.toMatch(/- ?8px/);
    expect(el.style.left).toMatch(/^calc\(0% \+ \d+px\)$/);
  });

  it('起點在軸內的列行為不變：標籤貼在條左側（left＝l% - 8px，右對齊）', () => {
    const c = renderBar(mk('2026/08/01', '2026/12/20'));
    const el = dl(c);
    expect(el.textContent).toBe('08/01');
    expect(el.className).not.toContain('in-bar');
    expect(el.style.left).toMatch(/^calc\([\d.]+% - 8px\)$/);
  });

  it('終點被右側裁切時終點標籤維持原樣（▸）', () => {
    const c = renderBar(mk('2026/08/01', '2027/06/20'));
    expect(c.querySelector('.dl.le').textContent).toBe('2027/06/20 ▸');
    expect(c.querySelector('.dl.le').className).not.toContain('in-bar');
  });
});
