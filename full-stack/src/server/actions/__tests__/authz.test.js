import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null }
                   : { session: null, error: 'UNAUTHORIZED' },
}));

// 授權沒過就不該碰 DB——任何 DB 呼叫都讓測試爆掉，這樣才證明是「短路」而非「執行完才丟掉」。
const boom = () => { throw new Error('授權沒過卻碰了 DB'); };
vi.mock('@/server/db', () => ({
  db: { select: boom, insert: boom, update: boom, delete: boom, execute: boom, transaction: boom },
}));
vi.mock('@/server/db/schema', () => ({
  tasks: {}, subtasks: {}, links: {}, files: {}, projects: {}, users: {}, configTable: {},
}));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/r2', () => ({ deleteFromR2: vi.fn(async () => {}) }));

const tasks = await import('@/server/actions/tasks');

const VIEWER = { userId: 'v1', role: 'viewer' };

// 每支寫入 action 與一組合法參數
const WRITE_ACTIONS = [
  ['createTask',      () => tasks.createTask({ projectId: 'p1', task: 'x' })],
  ['updateTask',      () => tasks.updateTask('11111111-1111-1111-1111-111111111111', { task: 'x' })],
  ['deleteTask',      () => tasks.deleteTask('11111111-1111-1111-1111-111111111111')],
  ['createSubtask',   () => tasks.createSubtask({ taskId: '11111111-1111-1111-1111-111111111111', name: 'x' })],
  ['updateSubtask',   () => tasks.updateSubtask('11111111-1111-1111-1111-111111111111', { name: 'x' })],
  ['deleteSubtask',   () => tasks.deleteSubtask('11111111-1111-1111-1111-111111111111')],
  ['toggleSubtask',   () => tasks.toggleSubtask('11111111-1111-1111-1111-111111111111')],
  ['createLink',      () => tasks.createLink({ taskId: '11111111-1111-1111-1111-111111111111', url: 'https://x' })],
  ['deleteLink',      () => tasks.deleteLink('11111111-1111-1111-1111-111111111111')],
  ['createFileRecord',() => tasks.createFileRecord({ taskId: '11111111-1111-1111-1111-111111111111', name: 'f', size: 1, mimeType: 'text/plain', r2Key: 'k' })],
  ['deleteFile',      () => tasks.deleteFile('11111111-1111-1111-1111-111111111111')],
  ['upsertTasks',     () => tasks.upsertTasks([])],
  ['updateManyTasks', () => tasks.updateManyTasks(['11111111-1111-1111-1111-111111111111'], { owner: 'A' })],
  ['deleteManyTasks', () => tasks.deleteManyTasks(['11111111-1111-1111-1111-111111111111'])],
  ['deleteAllTasks',  () => tasks.deleteAllTasks()],
];

beforeEach(() => { currentSession = null; });

describe('tasks.js：viewer 不能執行任何寫入', () => {
  it.each(WRITE_ACTIONS)('viewer 呼叫 %s → FORBIDDEN 且不碰 DB', async (_name, call) => {
    currentSession = VIEWER;
    await expect(call()).resolves.toEqual({ error: 'FORBIDDEN' });
  });

  it.each(WRITE_ACTIONS)('未登入呼叫 %s → UNAUTHORIZED 且不碰 DB', async (_name, call) => {
    currentSession = null;
    await expect(call()).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });
});

const projects = await import('@/server/actions/projects');

const PROJECT_WRITE_ACTIONS = [
  ['createProject',       () => { const fd = new FormData(); fd.set('name', 'P'); return projects.createProject(fd); }],
  ['updateProject',       () => projects.updateProject('11111111-1111-1111-1111-111111111111', { name: 'P' })],
  ['deleteProject',       () => projects.deleteProject('11111111-1111-1111-1111-111111111111')],
  ['deleteProjectBanner', () => projects.deleteProjectBanner('11111111-1111-1111-1111-111111111111')],
  ['reorderProjects',     () => projects.reorderProjects(['11111111-1111-1111-1111-111111111111'])],
];

describe('projects.js：viewer 不能執行任何寫入', () => {
  it.each(PROJECT_WRITE_ACTIONS)('viewer 呼叫 %s → FORBIDDEN 且不碰 DB', async (_n, call) => {
    currentSession = VIEWER;
    await expect(call()).resolves.toEqual({ error: 'FORBIDDEN' });
  });

  // 這條鎖住「ownership 不得 bypass role」——
  // 就算 viewer 是這個專案的 createdBy，也一樣不能改。
  it('viewer 即使是專案的 createdBy 也不能改（角色是全域硬上限）', async () => {
    currentSession = { userId: 'owner-1', role: 'viewer' };
    await expect(
      projects.updateProject('11111111-1111-1111-1111-111111111111', { name: 'X' })
    ).resolves.toEqual({ error: 'FORBIDDEN' });
    // db 全被設成會 throw，能回 FORBIDDEN 就證明沒去查 createdBy
  });
});
