import { describe, it, expect } from 'vitest';
import {
  TASK_EDITABLE_COLS,
  SUB_EDITABLE_COLS,
  getEditableCols,
  TASK_COL_TO_DB_FIELD,
  SERVER_WRITABLE_TASK_FIELDS,
  SERVER_WRITABLE_SUBTASK_FIELDS,
} from '@/lib/tableColumns';

// The data table decides which cells are editable from a hand-written list,
// the hook maps those names to DB columns from a second hand-written list, and
// the server action whitelists writable columns in a third. When those drift,
// the UI offers an edit that the server silently drops — which is exactly what
// happened with the `project` column: it was editable and keyboard-navigable,
// but `project` is in neither the hook's map nor the server whitelist, so
// editing it (or pressing Delete on it) did nothing and reported success.
//
// projectId is deliberately NOT writable — the server comment says the
// whitelist exists to "prevent tampering with createdBy, projectId, etc." So
// the correct fix is to stop presenting the cell as editable, and to keep the
// three lists provably in sync from here on.

describe('table column config', () => {
  it('does not offer the project column as editable', () => {
    expect(TASK_EDITABLE_COLS).not.toContain('project');
  });

  it('every editable task column maps to a server-writable DB field', () => {
    const unmapped = TASK_EDITABLE_COLS.filter(c => !TASK_COL_TO_DB_FIELD[c]);
    expect(unmapped).toEqual([]);

    const notWritable = TASK_EDITABLE_COLS
      .map(c => TASK_COL_TO_DB_FIELD[c])
      .filter(f => !SERVER_WRITABLE_TASK_FIELDS.includes(f));
    expect(notWritable).toEqual([]);
  });

  it('every editable subtask column is server-writable', () => {
    const notWritable = SUB_EDITABLE_COLS.filter(c => !SERVER_WRITABLE_SUBTASK_FIELDS.includes(c));
    expect(notWritable).toEqual([]);
  });

  it('still offers the columns that genuinely are editable', () => {
    for (const col of ['task', 'owner', 'status', 'priority', 'category', 'start', 'end', 'notes']) {
      expect(TASK_EDITABLE_COLS).toContain(col);
    }
  });

  it('getEditableCols picks the list by row type', () => {
    expect(getEditableCols('sub')).toBe(SUB_EDITABLE_COLS);
    expect(getEditableCols('task')).toBe(TASK_EDITABLE_COLS);
    expect(getEditableCols(undefined)).toBe(TASK_EDITABLE_COLS);
  });
});
