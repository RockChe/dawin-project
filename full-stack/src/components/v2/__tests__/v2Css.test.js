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
