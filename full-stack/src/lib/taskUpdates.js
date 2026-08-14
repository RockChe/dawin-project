import { pD, toISO } from './utils';

// form field name → DB column name
const FIELD_MAP = {
  task: 'task',
  status: 'status',
  category: 'category',
  priority: 'priority',
  owner: 'owner',
  notes: 'notes',
  start: 'startDate',
  end: 'endDate',
};

const DATE_FIELDS = new Set(['start', 'end']);

/**
 * Diff a TaskModal form against the task it was opened on, returning only the
 * fields that actually changed, keyed by DB column name.
 *
 * Two things this deliberately gets right:
 * - `start` is compared against `startDate` and `end` against `endDate`. The
 *   previous inline version compared BOTH against `startDate || endDate`, so
 *   editing one date fired a redundant write for the other.
 * - Dates are normalised with toISO() on both sides before comparing. The form
 *   holds CalendarPicker output ("2026/08/01 09:00") while the task holds the
 *   DB value ("2026-08-01"); comparing them raw never matched, so every save
 *   rewrote both dates plus duration even when only status changed.
 *
 * @returns {Array<{field: string, value: string|number|null}>}
 */
export function planTaskUpdates(task, form) {
  const updates = [];
  let dateChanged = false;

  for (const [formField, dbField] of Object.entries(FIELD_MAP)) {
    const isDate = DATE_FIELDS.has(formField);
    const orig = isDate ? toISO(task[dbField] ?? '') : (task[dbField] ?? '');
    const cur = isDate ? toISO(form[formField] ?? '') : (form[formField] ?? '');
    if (orig === cur) continue;
    updates.push({ field: dbField, value: isDate ? (cur || null) : cur });
    if (isDate) dateChanged = true;
  }

  // duration is derived, so only recompute it when a date actually moved and
  // both ends of the range are still set
  if (dateChanged) {
    const startISO = toISO(form.start ?? '');
    const endISO = toISO(form.end ?? '');
    if (startISO && endISO) {
      updates.push({
        field: 'duration',
        value: Math.max(1, Math.ceil((pD(endISO) - pD(startISO)) / 864e5)),
      });
    }
  }

  return updates;
}
