import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// /v2 不用 zoom，長輩可讀性靠真實字級：v2.css 與 v2 元件的字級一律 ≥ 14px（桌機）。
const css = readFileSync(resolve(process.cwd(), 'src/styles/v2.css'), 'utf8');

describe('v2.css 規則', () => {
  it('字級最小 14px（font-size 與 font 簡寫）', () => {
    const sizes = [
      ...[...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]),
      ...[...css.matchAll(/font\s*:\s*(?:\d+\s+|italic\s+|bold\s+)?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]),
    ];
    expect(sizes.length).toBeGreaterThan(20);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  });

  it('全部選擇器掛在 .v2 下，keyframes 以 v2- 前綴', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const kf = [...body.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(kf.every((n) => n.startsWith('v2-'))).toBe(true);
    // 每個一般規則的選擇器都以 .v2 開頭（@layer／@media／@container 的括號除外）
    const sel = [...body.matchAll(/(?:^|\})\s*([^@{}][^{}]*)\{/g)].map((m) => m[1].trim()).filter((s) => s && !s.includes('@') && !/^\d|^from|^to/.test(s));
    const bad = sel.filter((s) => s.split(',').some((x) => !x.trim().startsWith('.v2')));
    expect(bad).toEqual([]);
  });
});

// 名稱完整顯示（不得用省略號／強制單行切掉專案名與任務名）；甘特列高改 min-height，名稱換行時整列撐高
const bodiesOf = (sel) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].split(',').some((s) => s.trim() === sel)).map((m) => m[2]);
const NAME_SELECTORS = [
  '.v2 .tlx .lc .nm button.nb', // 甘特／Overview 時程：專案名
  '.v2 .tlx .chart.f .lc .nm b', // 甘特列名稱
  '.v2 .tlx .lane .cm b', // Timeline 卡片視圖標題
  '.v2 .pdx .trm .tnm', // 專案詳情任務名
  '.v2 .lrow .n', // 總覽即將到期／專案狀況名稱
  '.v2 .trw .n', // My Tasks 任務名
  '.v2 table.dt .cut', // Data 專案名欄
];

describe('v2.css：名稱完整顯示', () => {
  it.each(NAME_SELECTORS)('%s 不再 ellipsis／nowrap，且允許換行', (sel) => {
    const rules = bodiesOf(sel);
    expect(rules.length).toBeGreaterThan(0);
    for (const b of rules) {
      expect(b).not.toMatch(/text-overflow\s*:\s*ellipsis/);
      expect(b).not.toMatch(/white-space\s*:\s*nowrap/);
    }
    expect(rules.join(';')).toMatch(/overflow-wrap\s*:\s*anywhere/);
  });

  it('甘特列高改 min-height（任務列≥40、專案列≥48），不再寫死 height', () => {
    const body = (sel) => bodiesOf(sel).join(';');
    expect(body('.v2 .tlx .row')).toMatch(/min-height\s*:\s*40px/);
    expect(body('.v2 .tlx .chart.f .row.pj')).toMatch(/min-height\s*:\s*48px/);
    for (const sel of ['.v2 .tlx .row', '.v2 .tlx .chart.f .row.pj']) expect(body(sel)).not.toMatch(/(?<![-\w])height\s*:/);
  });

  it('條與日期標籤隨列高垂直置中（top 用 50% 而非寫死 px）', () => {
    for (const sel of ['.v2 .tlx .hb', '.v2 .tlx .dl', '.v2 .tlx .chart.f .row.pj .hb', '.v2 .tlx .chart.f .row.pj .dl']) {
      expect(bodiesOf(sel).join(';')).toMatch(/top\s*:\s*calc\(50%/);
    }
  });

  it('甘特左欄加寬（--lc 在 240–280px）', () => {
    const m = bodiesOf('.v2 .tlx .chart.f').join(';').match(/--lc\s*:\s*(\d+)px/);
    expect(+m[1]).toBeGreaterThanOrEqual(240);
    expect(+m[1]).toBeLessThanOrEqual(280);
  });
});
