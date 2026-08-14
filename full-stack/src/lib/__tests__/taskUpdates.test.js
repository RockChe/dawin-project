import { describe, it, expect } from 'vitest';
import { planTaskUpdates } from '@/lib/taskUpdates';

// Regression tests for the TaskModal save-diff logic.
//
// The old inline version in TaskModal.handleConfirm had two defects:
//
// 1. `orig` for BOTH start and end was computed as
//    `task.startDate || task.endDate || ""` — so the end date was compared
//    against the START date. Changing only the start date fired a redundant
//    endDate write, and vice versa.
// 2. `orig` came from the DB ("2026-08-01") while `cur` came from
//    CalendarPicker ("2026/08/01 09:00"), so the two were never equal in
//    format. Every save rewrote both dates plus duration even when the user
//    only touched an unrelated field like status.
//
// Extracted as a pure planner (mirroring hooks/reorderProjects.js) so the
// diff semantics are testable without mounting the modal.

const TASK = {
  task: 'T1',
  status: '待辦',
  category: '活動',
  priority: '中',
  owner: 'Rock',
  notes: 'n',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
};

// what the modal seeds into `form` when opened on TASK (unchanged state)
const FORM = {
  task: 'T1',
  start: '2026-08-01',
  end: '2026-08-10',
  category: '活動',
  priority: '中',
  owner: 'Rock',
  status: '待辦',
  notes: 'n',
};

const fieldsOf = (plan) => plan.map(u => u.field);

describe('planTaskUpdates', () => {
  it('returns nothing when the form is untouched', () => {
    expect(planTaskUpdates(TASK, FORM)).toEqual([]);
  });

  it('writes only the changed non-date field', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, status: '進行中' });
    expect(plan).toEqual([{ field: 'status', value: '進行中' }]);
  });

  it('does NOT write endDate when only the start date changed', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, start: '2026/09/01 09:00' });
    expect(fieldsOf(plan)).not.toContain('endDate');
    expect(plan).toContainEqual({ field: 'startDate', value: '2026-09-01' });
  });

  it('does NOT write startDate when only the end date changed', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, end: '2026/09/20 09:00' });
    expect(fieldsOf(plan)).not.toContain('startDate');
    expect(plan).toContainEqual({ field: 'endDate', value: '2026-09-20' });
  });

  it('treats picker format and DB format as the same date (no spurious write)', () => {
    // user opened the picker and re-picked the same day, with a time attached
    const plan = planTaskUpdates(TASK, { ...FORM, start: '2026/08/01 14:30' });
    expect(plan).toEqual([]);
  });

  it('does not touch dates or duration when only status changed', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, status: '已完成' });
    expect(fieldsOf(plan)).toEqual(['status']);
  });

  it('recomputes duration when a date changed and both dates are present', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, end: '2026/08/21' });
    expect(plan).toContainEqual({ field: 'duration', value: 20 });
  });

  it('omits duration when only one date is present', () => {
    const task = { ...TASK, endDate: null };
    const form = { ...FORM, end: '', start: '2026/09/01' };
    const plan = planTaskUpdates(task, form);
    expect(fieldsOf(plan)).not.toContain('duration');
    expect(plan).toContainEqual({ field: 'startDate', value: '2026-09-01' });
  });

  it('writes null when a date is cleared', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, start: '' });
    expect(plan).toContainEqual({ field: 'startDate', value: null });
  });

  it('maps form names to DB column names', () => {
    const plan = planTaskUpdates(TASK, { ...FORM, task: 'T2', notes: 'n2' });
    expect(fieldsOf(plan).sort()).toEqual(['notes', 'task']);
  });

  it('tolerates a task with no dates at all', () => {
    const task = { ...TASK, startDate: null, endDate: null };
    const form = { ...FORM, start: '', end: '' };
    expect(planTaskUpdates(task, form)).toEqual([]);
  });
});
