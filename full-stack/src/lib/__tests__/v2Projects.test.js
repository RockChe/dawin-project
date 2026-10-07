import { describe, it, expect, vi } from 'vitest';
import { projectCards, sortProjects, toggleHidden, onDragEnd, SORT_MODES } from '@/lib/v2Projects';
import { buildTwp } from '@/lib/v2Data';
import { FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY } from '@/components/v2/fixtures';

const twp = buildTwp(FIXTURE_TASKS, FIXTURE_SUBTASKS, FIXTURE_PROJECTS, FIXTURE_TODAY);
const cards = projectCards(twp, FIXTURE_PROJECTS, FIXTURE_TODAY);
const by = (id) => cards.find((c) => c.id === id);

describe('v2Projects.projectCards（對照設計稿 4 Projects）', () => {
  it('每個專案一張，含已封存；順序同 projects', () => {
    expect(cards.map((c) => c.id)).toEqual(FIXTURE_PROJECTS.map((p) => p.id));
    expect(cards.filter((c) => c.archived).map((c) => c.name)).toEqual(['臨時動議']);
  });

  it('TTXC：8 tasks・15 subtasks・54%；狀態依 STATUSES 順序（已完成2 進行中3 待辦1 暫緩1 待確認1）', () => {
    const c = by('p1');
    expect([c.n, c.subs, c.avg]).toEqual([8, 15, 54]);
    expect(c.counts).toEqual([['已完成', 2], ['進行中', 3], ['待辦', 1], ['暫緩', 1], ['待確認', 1]]);
  });

  it('其餘專案進度與設計稿一致', () => {
    expect(['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'].map((id) => by(id).avg)).toEqual([55, 27, 44, 92, 24, 0, 0, 55]);
  });

  it('專案色循環取自 projects 順序（與 Overview／My Tasks 同色）', () => {
    expect(cards.slice(0, 8).map((c) => c.color)).toEqual(['accent', 'purple', 'amber', 'red', 'green', 'cyan', 'pink', 'accent']);
  });

  it('專案狀況 chip：key／label／cloud（逾期＝有逾期＋烏雲）；沒有任務的專案不給 chip', () => {
    expect(by('p1')).toMatchObject({ key: 'over', label: '有逾期', cloud: 'dark' });
    const empty = projectCards([], [{ id: 'x', name: '空專案', sortOrder: 0 }], FIXTURE_TODAY)[0];
    expect(empty).toMatchObject({ n: 0, subs: 0, avg: 0, counts: [], key: null });
  });

  it('bannerUrl 有就帶出（沒有就 null，畫面改用首字母）', () => {
    const c = projectCards([], [{ id: 'x', name: '圖', bannerUrl: 'https://img/x.png' }, { id: 'y', name: '字' }], FIXTURE_TODAY);
    expect(c.map((x) => x.bannerUrl)).toEqual(['https://img/x.png', null]);
  });
});

describe('v2Projects.sortProjects', () => {
  const ids = (mode) => sortProjects(cards, mode).map((c) => c.id);
  it('只留未封存；手動＝sortOrder 升冪', () => {
    expect(ids('manual')).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p11']);
    const shuffled = [{ ...cards[1], sortOrder: 0 }, { ...cards[0], sortOrder: 5 }];
    expect(sortProjects(shuffled, 'manual').map((c) => c.id)).toEqual(['p2', 'p1']);
  });
  it('依名稱（zh-Hant）', () => {
    const names = sortProjects(cards, 'name').map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
  });
  it('依建立時間：新到舊', () => {
    expect(ids('created')).toEqual(['p11', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1']);
  });
  it('依進度：高到低，同分維持原順序', () => {
    expect(ids('progress')).toEqual(['p5', 'p2', 'p9', 'p1', 'p4', 'p3', 'p6', 'p7', 'p8', 'p11']);
  });
  it('四種排序選項（手動／名稱／建立／進度）', () => {
    expect(SORT_MODES.map(([k]) => k)).toEqual(['manual', 'name', 'created', 'progress']);
  });
  it('不改動輸入陣列', () => {
    const before = cards.map((c) => c.id);
    sortProjects(cards, 'name');
    expect(cards.map((c) => c.id)).toEqual(before);
  });
});

describe('v2Projects.toggleHidden', () => {
  it('加入／移除；不改原陣列；null／undefined 當空', () => {
    const a = ['p1'];
    expect(toggleHidden(a, 'p2')).toEqual(['p1', 'p2']);
    expect(toggleHidden(a, 'p1')).toEqual([]);
    expect(a).toEqual(['p1']);
    expect(toggleHidden(undefined, 'p3')).toEqual(['p3']);
    expect(toggleHidden(null, 'p3')).toEqual(['p3']);
  });
});

describe('v2Projects.onDragEnd（沿用 reorderProjects(activeId, overId)）', () => {
  it('落在別的專案上 → reorder(active, over)', () => {
    const reorder = vi.fn();
    onDragEnd(reorder)({ active: { id: 'p1' }, over: { id: 'p3' } });
    expect(reorder).toHaveBeenCalledWith('p1', 'p3');
  });
  it('原地放下／沒有目標 → 不呼叫', () => {
    const reorder = vi.fn();
    onDragEnd(reorder)({ active: { id: 'p1' }, over: { id: 'p1' } });
    onDragEnd(reorder)({ active: { id: 'p1' }, over: null });
    expect(reorder).not.toHaveBeenCalled();
  });
});
