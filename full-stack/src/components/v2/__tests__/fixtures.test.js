import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXTURE_TODAY, FIXTURE_TASKS, fixtureShellProps } from '@/components/v2/fixtures';
import { overallProgress } from '@/lib/v2Overall';

describe('v2 fixtures', () => {
  it('固定 today=2026-10-07，33 筆任務，Overall 與設計稿一致（45%）', () => {
    expect(FIXTURE_TODAY).toBe('2026-10-07');
    expect(FIXTURE_TASKS).toHaveLength(33);
    const p = fixtureShellProps();
    expect(overallProgress(p.tasks, p.subtasks, p.today)).toBe(45);
  });
  it('零副作用：不 import 任何 server／DB／fetch／儲存程式碼', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/v2/fixtures.js'), 'utf8');
    expect(src).not.toMatch(/@\/server|saveConfig|dash_cache|fetch\(|sessionStorage|localStorage|new Date\(\)|Date\.now/);
  });
  it('產生資料不呼叫 fetch', () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    fixtureShellProps();
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
