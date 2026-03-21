import { getSheetsClient } from './google';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import crypto from 'crypto';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Sheet column definitions (order must match header row)
const COLUMNS = {
  users: ['id', 'email', 'passwordHash', 'role', 'name', 'mustChangePassword', 'createdAt', 'updatedAt'],
  sessions: ['id', 'userId', 'token', 'expiresAt', 'createdAt'],
  projects: ['id', 'name', 'sortOrder', 'createdBy', 'createdAt', 'updatedAt'],
  tasks: ['id', 'projectId', 'task', 'status', 'category', 'startDate', 'endDate', 'duration', 'owner', 'priority', 'notes', 'sortOrder', 'createdBy', 'createdAt', 'updatedAt'],
  subtasks: ['id', 'taskId', 'name', 'owner', 'done', 'doneDate', 'notes', 'sortOrder', 'createdAt'],
  links: ['id', 'taskId', 'url', 'title', 'createdBy', 'createdAt'],
  config: ['id', 'key', 'value', 'updatedAt'],
  files: ['id', 'taskId', 'name', 'size', 'mimeType', 'r2Key', 'createdBy', 'createdAt'],
};

// Boolean fields that need conversion
const BOOL_FIELDS = { mustChangePassword: true, done: true };

// Integer fields
const INT_FIELDS = { sortOrder: true, duration: true, size: true };

// Convert 1-based column number to letter (1→A, 26→Z, 27→AA, etc.)
function colLetter(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// ─── Low-level helpers ───

function rowToObject(headers, values, rowIndex) {
  const obj = { _rowIndex: rowIndex };
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    let val = values[i] ?? null;
    // Type conversions
    if (val !== null && val !== '') {
      if (BOOL_FIELDS[key]) val = val === 'true' || val === true;
      else if (INT_FIELDS[key]) val = Number(val);
    } else {
      val = null;
    }
    obj[key] = val;
  }
  return obj;
}

function objectToRow(headers, obj) {
  return headers.map(key => {
    const val = obj[key];
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toISOString();
    return String(val);
  });
}

// ─── Generic CRUD ───

export async function readSheet(sheetName) {
  const cacheKey = `sheet:${sheetName}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rawRows = res.data.values || [];
  if (rawRows.length <= 1) return []; // only header or empty

  const headers = rawRows[0];
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    rows.push(rowToObject(headers, rawRows[i], i + 1)); // _rowIndex is 1-based sheet row
  }

  // Cache reads (except sessions for security)
  if (sheetName !== 'sessions') {
    cacheSet(cacheKey, rows);
  }

  return rows;
}

export async function appendRow(sheetName, data) {
  const headers = COLUMNS[sheetName];
  const now = new Date().toISOString();

  // Set defaults
  if (!data.id) data.id = crypto.randomUUID();
  if (headers.includes('createdAt') && !data.createdAt) data.createdAt = now;
  if (headers.includes('updatedAt') && !data.updatedAt) data.updatedAt = now;

  const row = objectToRow(headers, data);
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  cacheInvalidate(`sheet:${sheetName}`);

  // Return the created object (simulate .returning())
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    let val = data[key] ?? null;
    if (val !== null && val !== undefined) {
      if (BOOL_FIELDS[key]) val = val === 'true' ? true : val === true;
      if (INT_FIELDS[key]) val = Number(val);
    }
    obj[key] = val;
  }
  return obj;
}

export async function appendRows(sheetName, dataArray) {
  if (!dataArray.length) return;
  const headers = COLUMNS[sheetName];
  const now = new Date().toISOString();

  const rows = dataArray.map(data => {
    if (!data.id) data.id = crypto.randomUUID();
    if (headers.includes('createdAt') && !data.createdAt) data.createdAt = now;
    if (headers.includes('updatedAt') && !data.updatedAt) data.updatedAt = now;
    return objectToRow(headers, data);
  });

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });

  cacheInvalidate(`sheet:${sheetName}`);
}

export async function updateRow(sheetName, rowIndex, data) {
  const headers = COLUMNS[sheetName];

  // Read the existing row first
  const sheets = getSheetsClient();
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:${colLetter(headers.length)}${rowIndex}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const currentValues = existing.data.values?.[0] || [];
  const merged = {};
  for (let i = 0; i < headers.length; i++) {
    merged[headers[i]] = currentValues[i] ?? '';
  }

  // Apply updates
  for (const [key, val] of Object.entries(data)) {
    if (headers.includes(key)) {
      merged[key] = val;
    }
  }

  if (headers.includes('updatedAt')) {
    merged.updatedAt = new Date().toISOString();
  }

  const row = objectToRow(headers, merged);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:${colLetter(headers.length)}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  cacheInvalidate(`sheet:${sheetName}`);
}

export async function deleteRow(sheetName, rowIndex) {
  const sheets = getSheetsClient();

  // Get the sheetId (gid) for this tab
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex,
          },
        },
      }],
    },
  });

  cacheInvalidate(`sheet:${sheetName}`);
}

export async function findRows(sheetName, predicate) {
  const rows = await readSheet(sheetName);
  return rows.filter(predicate);
}

export async function findRow(sheetName, predicate) {
  const rows = await readSheet(sheetName);
  return rows.find(predicate) || null;
}

export async function clearSheetData(sheetName) {
  const sheets = getSheetsClient();

  // Get sheet metadata
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const rowCount = sheet.properties.gridProperties.rowCount;
  if (rowCount <= 1) return; // only header

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: 1, // keep header (row 0)
            endIndex: rowCount,
          },
        },
      }],
    },
  });

  cacheInvalidate(`sheet:${sheetName}`);
}

// ─── Users ───

export async function findUserByEmail(email) {
  return findRow('users', r => r.email === email);
}

export async function findUserById(id) {
  return findRow('users', r => r.id === id);
}

export async function insertUser(data) {
  return appendRow('users', {
    ...data,
    mustChangePassword: data.mustChangePassword ?? true,
  });
}

export async function updateUser(id, data) {
  const user = await findRow('users', r => r.id === id);
  if (!user) throw new Error('User not found');
  await updateRow('users', user._rowIndex, data);
}

export async function deleteUserById(id) {
  // Cascade: delete sessions first
  const userSessions = await findRows('sessions', r => r.userId === id);
  // Delete from bottom to top to avoid row index shifting
  for (const s of userSessions.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('sessions', s._rowIndex);
  }
  const user = await findRow('users', r => r.id === id);
  if (user) await deleteRow('users', user._rowIndex);
}

export async function getAllUsers() {
  const rows = await readSheet('users');
  return rows.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export async function countUsers() {
  const rows = await readSheet('users');
  return rows.length;
}

// ─── Sessions ───

export async function insertSession(data) {
  return appendRow('sessions', data);
}

export async function findSessionByToken(token) {
  return findRow('sessions', r => r.token === token);
}

export async function deleteSessionByToken(token) {
  const session = await findRow('sessions', r => r.token === token);
  if (session) await deleteRow('sessions', session._rowIndex);
}

export async function deleteSessionsByUserId(userId) {
  const sessions = await findRows('sessions', r => r.userId === userId);
  for (const s of sessions.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('sessions', s._rowIndex);
  }
}

// ─── Projects ───

export async function getAllProjects() {
  const rows = await readSheet('projects');
  return rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export async function findProjectById(id) {
  return findRow('projects', r => r.id === id);
}

export async function insertProject(data) {
  return appendRow('projects', data);
}

export async function updateProject(id, data) {
  const project = await findRow('projects', r => r.id === id);
  if (!project) throw new Error('Project not found');
  await updateRow('projects', project._rowIndex, data);
}

export async function deleteProjectById(id) {
  // Cascade: delete all tasks under this project (which cascades subtasks/links/files)
  const projectTasks = await findRows('tasks', r => r.projectId === id);
  for (const t of projectTasks) {
    await deleteTaskById(t.id);
  }
  const project = await findRow('projects', r => r.id === id);
  if (project) await deleteRow('projects', project._rowIndex);
}

export async function getMaxProjectSortOrder() {
  const rows = await readSheet('projects');
  if (rows.length === 0) return 0;
  return Math.max(...rows.map(r => r.sortOrder || 0));
}

// ─── Tasks ───

export async function getAllTasksOrdered() {
  const rows = await readSheet('tasks');
  return rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function findTaskById(id) {
  return findRow('tasks', r => r.id === id);
}

export async function findTasksByProjectId(projectId) {
  const rows = await findRows('tasks', r => r.projectId === projectId);
  return rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function findTaskByProjectAndName(projectId, taskName) {
  return findRow('tasks', r => r.projectId === projectId && r.task === taskName);
}

export async function insertTask(data) {
  return appendRow('tasks', {
    ...data,
    status: data.status || '待辦',
    priority: data.priority || '中',
    sortOrder: data.sortOrder || 0,
  });
}

export async function updateTask(id, data) {
  const task = await findRow('tasks', r => r.id === id);
  if (!task) throw new Error('Task not found');
  await updateRow('tasks', task._rowIndex, data);
}

export async function deleteTaskById(id) {
  // Cascade: delete subtasks, links, files
  const subs = await findRows('subtasks', r => r.taskId === id);
  for (const s of subs.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('subtasks', s._rowIndex);
  }
  const lnks = await findRows('links', r => r.taskId === id);
  for (const l of lnks.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('links', l._rowIndex);
  }
  const fls = await findRows('files', r => r.taskId === id);
  for (const f of fls.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('files', f._rowIndex);
  }
  const task = await findRow('tasks', r => r.id === id);
  if (task) await deleteRow('tasks', task._rowIndex);
}

export async function deleteAllTaskRows() {
  // Clear all 4 related sheets
  await clearSheetData('subtasks');
  await clearSheetData('links');
  await clearSheetData('files');
  await clearSheetData('tasks');
}

// ─── Subtasks ───

export async function getAllSubtasksOrdered() {
  const rows = await readSheet('subtasks');
  return rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function findSubtaskById(id) {
  return findRow('subtasks', r => r.id === id);
}

export async function findSubtasksByTaskIds(taskIds) {
  const rows = await readSheet('subtasks');
  return rows.filter(r => taskIds.includes(r.taskId)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function insertSubtask(data) {
  return appendRow('subtasks', {
    ...data,
    done: data.done ?? false,
    sortOrder: data.sortOrder || 0,
  });
}

export async function updateSubtask(id, data) {
  const sub = await findRow('subtasks', r => r.id === id);
  if (!sub) throw new Error('Subtask not found');
  await updateRow('subtasks', sub._rowIndex, data);
}

export async function deleteSubtask(id) {
  const sub = await findRow('subtasks', r => r.id === id);
  if (sub) await deleteRow('subtasks', sub._rowIndex);
}

export async function deleteSubtasksByTaskId(taskId) {
  const subs = await findRows('subtasks', r => r.taskId === taskId);
  for (const s of subs.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('subtasks', s._rowIndex);
  }
}

// ─── Links ───

export async function getAllLinksOrdered() {
  const rows = await readSheet('links');
  return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function insertLink(data) {
  return appendRow('links', data);
}

export async function deleteLink(id) {
  const link = await findRow('links', r => r.id === id);
  if (link) await deleteRow('links', link._rowIndex);
}

export async function deleteLinksByTaskId(taskId) {
  const lnks = await findRows('links', r => r.taskId === taskId);
  for (const l of lnks.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('links', l._rowIndex);
  }
}

// ─── Files ───

export async function getAllFilesOrdered() {
  const rows = await readSheet('files');
  return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function findFilesByTaskId(taskId) {
  return findRows('files', r => r.taskId === taskId);
}

export async function findFileById(id) {
  return findRow('files', r => r.id === id);
}

export async function insertFile(data) {
  return appendRow('files', data);
}

export async function deleteFileById(id) {
  const file = await findRow('files', r => r.id === id);
  if (file) await deleteRow('files', file._rowIndex);
}

export async function deleteFilesByTaskId(taskId) {
  const fls = await findRows('files', r => r.taskId === taskId);
  for (const f of fls.sort((a, b) => b._rowIndex - a._rowIndex)) {
    await deleteRow('files', f._rowIndex);
  }
}

export async function getAllFileRows() {
  return readSheet('files');
}

// ─── Config ───

export async function getConfigByKey(key) {
  return findRow('config', r => r.key === key);
}

export async function getConfigsByKeys(keys) {
  const rows = await readSheet('config');
  return rows.filter(r => keys.includes(r.key));
}

export async function upsertConfig(key, value) {
  const existing = await findRow('config', r => r.key === key);
  if (existing) {
    await updateRow('config', existing._rowIndex, { value, updatedAt: new Date().toISOString() });
  } else {
    await appendRow('config', { key, value });
  }
}
