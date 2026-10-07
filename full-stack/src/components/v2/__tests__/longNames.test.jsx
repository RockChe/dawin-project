import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PermissionProvider } from '@/components/PermissionProvider';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import { V2SettingsProvider } from '@/components/v2/SettingsContext';
import Timeline from '@/components/v2/Timeline';
import Overview from '@/components/v2/Overview';
import ProjectDetail from '@/components/v2/ProjectDetail';
import Data from '@/components/v2/Data';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY, FIXTURE_OWNERS } from '@/components/v2/fixtures';

const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));
vi.mock('@/server/actions/projects', () => new Proxy({}, { get: () => boom }));
vi.mock('@/server/actions/tasks', () => new Proxy({}, { get: () => boom }));

// 長名稱（≥30 字）必須完整出現在 DOM；是否被視覺切掉由 v2Css.test.js 鎖 CSS
const LONG_P = '虎姑婆駁二特展與周邊商品聯名企劃暨售票系統串接及現場人力排班完整規劃專案';
const LONG_T = '商品合作授權合約確認與周邊品項清單打樣驗收暨包裝設計稿第二輪修正作業事項';
const projects = FIXTURE_PROJECTS.map((p) => (p.id === 'p1' ? { ...p, name: LONG_P } : p));
const tasks = FIXTURE_TASKS.map((t) => (t.id === 't2' ? { ...t, task: LONG_T } : t));
const twp = buildTwp(tasks, FIXTURE_SUBTASKS, projects, FIXTURE_TODAY);
const wrap = (ui, settings = {}) => (
  <PermissionProvider role="admin">
    <CloudLevelProvider level="full">
      <V2SettingsProvider value={{ settings, updateSetting: vi.fn(), ready: true }}>{ui}</V2SettingsProvider>
    </CloudLevelProvider>
  </PermissionProvider>
);
const noClip = (el) => { expect(el.style.textOverflow).not.toBe('ellipsis'); expect(el.style.whiteSpace).not.toBe('nowrap'); };
const actions = () => new Proxy({}, { get: () => vi.fn() });
const timeline = (settings) => render(wrap(<Timeline twp={twp} projects={projects} userNames={FIXTURE_OWNERS} today={FIXTURE_TODAY} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />, settings));

describe('長名稱完整顯示', () => {
  it('Timeline 甘特：專案名與任務名完整', () => {
    const { container } = timeline({ timelineDefaultCollapsed: false });
    const pj = container.querySelector('.row.pj .nm b');
    expect(pj.textContent).toBe(LONG_P);
    noClip(pj);
    expect([...container.querySelectorAll('.row.tk .nm b')].map((b) => b.textContent)).toContain(LONG_T);
  });

  it('Timeline 卡片視圖：專案名完整', () => {
    const { container } = timeline({ timelineView: 'card' });
    expect(container.textContent).toContain(LONG_P);
  });

  it('Overview：即將到期任務名與時程專案名完整', () => {
    const { container } = render(wrap(<Overview twp={twp} projects={projects} userName="Rock" userNames={FIXTURE_OWNERS} today={FIXTURE_TODAY} onJumpMy={vi.fn()} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />));
    expect([...container.querySelectorAll('.lrow .n')].map((e) => e.textContent)).toContain(LONG_T);
    expect([...container.querySelectorAll('.tlx .nb')].map((e) => e.textContent)).toContain(LONG_P);
  });

  it('ProjectDetail：任務名完整', () => {
    const { container } = render(wrap(<ProjectDetail project={projects[0]} projects={projects} twp={twp} subtasks={FIXTURE_SUBTASKS} userNames={FIXTURE_OWNERS} today={FIXTURE_TODAY} actions={actions()} onBack={vi.fn()} onOpenTask={vi.fn()} />));
    const els = [...container.querySelectorAll('.trow .tnm')];
    expect(els.map((e) => e.textContent)).toContain(LONG_T);
    els.forEach(noClip);
  });

  it('Data：專案名欄完整', () => {
    const { container } = render(wrap(<Data twp={twp} subtasks={FIXTURE_SUBTASKS} projects={projects} userNames={FIXTURE_OWNERS} config={{ cats: ['活動'], owners: FIXTURE_OWNERS }} today={FIXTURE_TODAY} actions={actions()} />));
    expect([...container.querySelectorAll('[data-col="project"] .cut')].map((e) => e.textContent)).toContain(LONG_P);
  });
});
