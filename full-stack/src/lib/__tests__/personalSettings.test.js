import { describe, it, expect } from 'vitest';
import {
  TAB_KEYS, resolveTab, resolveTimeDim, collectLegacySettings, resolveGanttWidths,
  DEFAULT_GANTT_WIDTHS, orderProjBars,
} from '@/lib/personalSettings';

const store = (obj) => ({ getItem: (k) => (k in obj ? obj[k] : null) });

describe('resolveTab (tab key validation)', () => {
  it('accepts every allowed key', () => {
    for (const k of TAB_KEYS) expect(resolveTab(k)).toBe(k);
  });
  it('falls back to overview for unknown / non-string / missing', () => {
    for (const bad of ['nope', '', 42, null, undefined, {}]) expect(resolveTab(bad)).toBe('overview');
  });
});

describe('resolveTimeDim', () => {
  it('keeps 日週月季, falls back to 月', () => {
    for (const d of ['日', '週', '月', '季']) expect(resolveTimeDim(d)).toBe(d);
    expect(resolveTimeDim('年')).toBe('月');
    expect(resolveTimeDim(undefined)).toBe('月');
  });
});

describe('resolveGanttWidths', () => {
  it('returns defaults when nothing saved', () => {
    expect(resolveGanttWidths(undefined)).toEqual(DEFAULT_GANTT_WIDTHS);
  });
  it('fills missing views/keys from defaults', () => {
    const r = resolveGanttWidths({ overview: { day: 33 } });
    expect(r.overview).toEqual({ ...DEFAULT_GANTT_WIDTHS.overview, day: 33 });
    expect(r.timeline).toEqual(DEFAULT_GANTT_WIDTHS.timeline);
  });
});

describe('collectLegacySettings (one-time localStorage migration)', () => {
  const LS = {
    'dash-activeTab': 'projects',
    'dash-timelineHeight': '120',
    'dash-upcomingDays': '14',
    'dash-upcomingLimit': '8',
    'dash-ganttWidths': JSON.stringify({ overview: { day: 1, week: 2, month: 3, quarter: 4 }, project: {}, timeline: {} }),
  };

  it('adopts old localStorage values for keys the user has no saved value for', () => {
    const r = collectLegacySettings({}, store(LS));
    expect(r.activeTab).toBe('projects');
    expect(r.timelineHeight).toBe(120);
    expect(r.upcomingDays).toBe(14);
    expect(r.upcomingLimit).toBe(8);
    expect(r.ganttWidths.overview.month).toBe(3);
  });

  it('does nothing for a key the server already has (even a falsy-looking value)', () => {
    const r = collectLegacySettings({ activeTab: 'overview', upcomingDays: 0 }, store(LS));
    expect(r).not.toHaveProperty('activeTab');
    expect(r).not.toHaveProperty('upcomingDays');
    expect(r.timelineHeight).toBe(120);
  });

  it('does nothing when neither server nor localStorage has the key', () => {
    expect(collectLegacySettings({}, store({}))).toEqual({});
  });

  it('skips invalid legacy values (bad tab, NaN, broken JSON)', () => {
    const r = collectLegacySettings({}, store({
      'dash-activeTab': 'bogus', 'dash-timelineHeight': 'abc', 'dash-ganttWidths': '{oops',
    }));
    expect(r).toEqual({});
  });

  it('expands the oldest single-group ganttWidths format into three views', () => {
    const r = collectLegacySettings({}, store({ 'dash-ganttWidths': JSON.stringify({ day: 9, week: 8, month: 7, quarter: 6 }) }));
    expect(r.ganttWidths.overview.day).toBe(9);
    expect(r.ganttWidths.project.week).toBe(8);
    expect(r.ganttWidths.timeline.quarter).toBe(6);
  });

  it('is safe when storage is unavailable', () => {
    expect(collectLegacySettings({}, null)).toEqual({});
    expect(collectLegacySettings({}, { getItem() { throw new Error('denied'); } })).toEqual({});
  });
});

describe('orderProjBars (Overview follows the Projects tab order)', () => {
  const bars = ['C', 'Z', 'A', 'B'].map(name => ({ name }));
  it('orders by projects[].sortOrder; projects not in the list go last in original order', () => {
    const projects = [
      { name: 'A', sortOrder: 1 }, { name: 'B', sortOrder: 2 }, { name: 'C', sortOrder: 3 },
    ];
    expect(orderProjBars(bars, projects).map(b => b.name)).toEqual(['A', 'B', 'C', 'Z']);
  });
  it('is stable on equal sortOrder (keeps projects-array order = createdAt tiebreak)', () => {
    const projects = [{ name: 'B', sortOrder: 0 }, { name: 'A', sortOrder: 0 }, { name: 'C', sortOrder: 0 }];
    expect(orderProjBars(bars, projects).map(b => b.name)).toEqual(['B', 'A', 'C', 'Z']);
  });
  it('without projects keeps the incoming order and does not mutate input', () => {
    expect(orderProjBars(bars, undefined)).toEqual(bars);
    const copy = bars.slice();
    orderProjBars(bars, [{ name: 'A', sortOrder: 1 }]);
    expect(bars).toEqual(copy);
  });
});
