import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import MyTasks from '@/components/v2/MyTasks';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

const { boom } = vi.hoisted(() => ({ boom: vi.fn(() => { throw new Error('server action called'); }) }));
vi.mock('@/server/actions/userSettings', () => ({ getUserSettings: boom, setUserSetting: boom }));

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('svg').forEach((v) => v.remove()); return c.textContent; };
let onOpenTask;
const setup = ({ level = 'full', ...over } = {}) => {
  onOpenTask = vi.fn();
  return render(
    <CloudLevelProvider level={level}>
      <MyTasks twp={twp} projects={FIXTURE_PROJECTS} userName="Rock" today={FIXTURE_TODAY} onOpenTask={onOpenTask} {...over} />
    </CloudLevelProvider>
  );
};
const group = (c, g) => c.querySelector(`.mgrp[data-g="${g}"]`);
const names = (el) => [...el.querySelectorAll('.trw .n')].map((n) => txt(n));
beforeEach(() => { boom.mockClear(); });

describe('My Tasks：KPI', () => {
  it('四張卡：已逾期／7 天內到期／進行中／本月已完成（與設計稿 3・3・4・3）', () => {
    const { container } = setup();
    const cards = [...container.querySelectorAll('.kpis .kpi')].map((c) => [c.querySelector('.kpi-n').textContent, c.querySelector('small').textContent]);
    expect(cards).toEqual([['3', '已逾期'], ['3', '7 天內到期'], ['4', '進行中'], ['3', '本月已完成']]);
  });

  it('KPI 帶雲：烏／粉紅／白／筋斗；雲關閉退回純數字', () => {
    const { container } = setup();
    expect([...container.querySelectorAll('.kpis .kpi .cl svg title')].map((t) => t.textContent)).toEqual(['烏雲', '粉紅雲', '白雲', '筋斗雲']);
    const off = setup({ level: 'off' });
    expect(off.container.querySelectorAll('.kpis .cl')).toHaveLength(0);
    expect(off.container.querySelectorAll('.kpis .kpi-n')).toHaveLength(4);
  });
});

describe('My Tasks：分組與列', () => {
  it('預設三組（逾期 3／7 天內 3／之後 4），沒有已完成分組；各組依到期日排序', () => {
    const { container } = setup();
    expect([...container.querySelectorAll('.mgrp')].map((g) => g.dataset.g)).toEqual(['overdue', 'soon', 'later']);
    expect(names(group(container, 'overdue'))).toEqual(['票務展務相關我執行', '整理發行資料-片單我關注', '文化部結案報告我執行']);
    expect(names(group(container, 'soon'))).toEqual(['商品合作我執行', '連連玩境影視展我關注', "Yaya's Band 芽芽樂團我執行"]);
    expect(names(group(container, 'later'))).toEqual(['衛武營場地勘查我執行', '展覽提案簡報我關注', '開幕記者會我關注', 'Q4 內容企劃我執行']);
    expect([...container.querySelectorAll('.mgrp > h3 .cnt')].map((c) => c.textContent)).toEqual(['3', '3', '4']);
  });

  it('分組標題帶雲：逾期＝烏雲、7 天內＝粉紅雲、之後＝淡紫雲；文字在旁邊', () => {
    const { container } = setup();
    const t = (g) => [group(container, g).querySelector('h3 .cl svg title').textContent, group(container, g).querySelector('h3 > span:not(.cl):not(.cnt)').textContent];
    expect(t('overdue')).toEqual(['烏雲', '逾期']);
    expect(t('soon')).toEqual(['粉紅雲', '7 天內']);
    expect(t('later')).toEqual(['淡紫雲', '之後']);
  });

  it('一列：專案色點、名稱＋身分徽章、專案名、狀態、進度條、到期天數與日期', () => {
    const { container } = setup();
    const r = group(container, 'overdue').querySelector('.trw');
    expect(txt(r.querySelector('.n'))).toBe('票務展務相關我執行');
    expect(r.querySelector('.badge').textContent).toBe('我執行');
    expect(r.querySelector('.s').textContent).toBe('TTXC 虎姑婆 駁二');
    expect(r.querySelector('.st').textContent).toBe('進行中');
    expect(r.querySelector('.bar').getAttribute('aria-valuenow')).toBe('60');
    expect(r.querySelector('.due b').textContent).toBe('-12d');
    expect(r.querySelector('.due span').textContent).toBe('2026/09/25');
    expect(r.querySelector('.pdot')).not.toBeNull();
  });

  it('點一列 → onOpenTask(該任務)（本 wave 預設 no-op，由父層接任務視窗）', () => {
    const { container } = setup();
    fireEvent.click(group(container, 'soon').querySelector('.trw'));
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
  });

  it('沒傳 onOpenTask 點列不報錯', () => {
    const { container } = render(<MyTasks twp={twp} projects={FIXTURE_PROJECTS} userName="Rock" today={FIXTURE_TODAY} />);
    expect(() => fireEvent.click(group(container, 'soon').querySelector('.trw'))).not.toThrow();
  });
});

describe('My Tasks：狀態篩選（多選）', () => {
  const chips = (c) => within(c.querySelector('[role="group"][aria-label^="狀態篩選"]'));

  it('7 個 chip（全部＋6 狀態），預設全部按下', () => {
    const { container } = setup();
    const b = [...container.querySelectorAll('[aria-label^="狀態篩選"] .chip')];
    expect(b.map((x) => x.textContent)).toEqual(['全部', '進行中', '待辦', '已完成', '暫緩', '提案中', '待確認']);
    expect(b.map((x) => x.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false']);
  });

  it('選「已完成」才出現已完成分組（依到期日新到舊）；再按「全部」清除', () => {
    const { container } = setup();
    fireEvent.click(chips(container).getByRole('button', { name: '已完成' }));
    expect([...container.querySelectorAll('.mgrp')].map((g) => g.dataset.g)).toEqual(['done']);
    expect(names(group(container, 'done'))).toEqual(['新聞稿發送', '虎姑婆周邊打樣確認我執行', '合夥合約簽署', '9 月帳務結算']);
    expect(group(container, 'done').querySelector('h3 .cl svg title').textContent).toBe('筋斗雲');
    fireEvent.click(chips(container).getByRole('button', { name: '全部' }));
    expect(container.querySelector('.mgrp[data-g="done"]')).toBeNull();
    expect(container.querySelectorAll('.mgrp')).toHaveLength(3);
  });

  it('多選取聯集：進行中＋待確認', () => {
    const { container } = setup();
    fireEvent.click(chips(container).getByRole('button', { name: '進行中' }));
    fireEvent.click(chips(container).getByRole('button', { name: '待確認' }));
    const all = [...container.querySelectorAll('.trw .st')].map((s) => s.textContent);
    expect(new Set(all)).toEqual(new Set(['進行中', '待確認']));
    expect(chips(container).getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('篩選後沒結果：淡紫雲＋「沒有符合篩選的任務」＋清除篩選', () => {
    const { container } = setup();
    fireEvent.click(chips(container).getByRole('button', { name: '暫緩' })); // Rock 沒有暫緩的任務
    const e = container.querySelector('.empty');
    expect(txt(e)).toContain('沒有符合篩選的任務');
    expect(e.querySelector('.cl svg title').textContent).toBe('淡紫雲');
    expect(container.querySelectorAll('.mgrp')).toHaveLength(0);
    fireEvent.click(within(e).getByRole('button', { name: '清除篩選' }));
    expect(container.querySelector('.empty')).toBeNull();
    expect(container.querySelectorAll('.mgrp')).toHaveLength(3);
  });

  it('沒有任務：筋斗雲＋「沒有指派給你的任務」', () => {
    const { container } = setup({ userName: '新同事' });
    const e = container.querySelector('.empty');
    expect(txt(e)).toContain('沒有指派給你的任務');
    expect(txt(e)).toContain('今天可以喘口氣了');
    expect(e.querySelector('.cl svg title').textContent).toBe('筋斗雲');
    expect(container.querySelectorAll('.kpis .kpi-n')[0].textContent).toBe('0');
  });
});

describe('My Tasks：從 Overview 跳來（focus）', () => {
  it('focus.group=soon：捲到「7 天內」並聚焦；篩選清空', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { container, rerender } = setup();
    fireEvent.click(within(container.querySelector('[aria-label^="狀態篩選"]')).getByRole('button', { name: '已完成' }));
    rerender(
      <CloudLevelProvider level="full">
        <MyTasks twp={twp} projects={FIXTURE_PROJECTS} userName="Rock" today={FIXTURE_TODAY} focus={{ group: 'soon', n: 1 }} />
      </CloudLevelProvider>
    );
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(group(container, 'soon'));
    expect(container.querySelectorAll('.mgrp')).toHaveLength(3);
  });

  it('focus.group=done：先選「已完成」讓分組出現，再捲到它', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = setup({ focus: { group: 'done', n: 1 } });
    expect(group(container, 'done')).not.toBeNull();
    expect(document.activeElement).toBe(group(container, 'done'));
  });
});

describe('My Tasks：只讀', () => {
  it('操作篩選不呼叫任何 server action', () => {
    const { container } = setup();
    fireEvent.click(within(container.querySelector('[aria-label^="狀態篩選"]')).getByRole('button', { name: '待辦' }));
    expect(boom).not.toHaveBeenCalled();
  });
});
