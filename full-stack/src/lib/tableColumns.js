// Column configuration for the data table's keyboard grid.
//
// Kept here (rather than inline in DataTab) so the invariant "every editable
// column is actually writable on the server" can be asserted in tests. Three
// hand-written lists have to agree: what the table lets you edit, how the hook
// maps a column name to a DB field, and what the server action whitelists. When
// they drifted, the UI offered an edit the server silently discarded.

/**
 * Task columns the grid allows editing / keyboard navigation on.
 *
 * `project` is intentionally absent: a task's project is `projectId`, which the
 * server action deliberately excludes from its whitelist ("prevent tampering
 * with createdBy, projectId, etc."). Moving a task between projects would need
 * its own action, validation and UX — it is not an inline cell edit.
 */
export const TASK_EDITABLE_COLS = ['task', 'owner', 'status', 'priority', 'category', 'start', 'end', 'notes'];

export const SUB_EDITABLE_COLS = ['name', 'owner', 'notes'];

export const getEditableCols = (type) => (type === 'sub' ? SUB_EDITABLE_COLS : TASK_EDITABLE_COLS);

/** Grid column name → tasks table column. Mirrors the map in useTaskManager. */
export const TASK_COL_TO_DB_FIELD = {
  task: 'task',
  status: 'status',
  category: 'category',
  start: 'startDate',
  end: 'endDate',
  duration: 'duration',
  owner: 'owner',
  priority: 'priority',
  notes: 'notes',
};

/** Mirrors the ALLOWED whitelist in server/actions/tasks.js updateTask. */
export const SERVER_WRITABLE_TASK_FIELDS = [
  'task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder',
];

/** Mirrors the ALLOWED whitelist in server/actions/tasks.js updateSubtask. */
export const SERVER_WRITABLE_SUBTASK_FIELDS = ['name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder'];
