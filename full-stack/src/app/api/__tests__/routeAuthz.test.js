import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentSession = null;
vi.mock('@/lib/auth', () => ({
  safeRequireAuth: async () =>
    currentSession ? { session: currentSession, error: null }
                   : { session: null, error: 'UNAUTHORIZED' },
  getSession: async () => currentSession,
}));

// 授權沒過就不該碰 R2 或 DB
const boom = () => { throw new Error('授權沒過卻做了副作用'); };
vi.mock('@/lib/r2', () => ({ uploadToR2: boom, deleteFromR2: boom, getPresignedUrl: boom }));
vi.mock('@/server/db', () => ({ db: { select: boom, insert: boom, update: boom, delete: boom } }));
vi.mock('@/server/db/schema', () => ({ projects: {}, files: {}, tasks: {} }));
vi.mock('@/server/actions/tasks', () => ({ createFileRecord: boom }));

const upload       = await import('@/app/api/upload/route');
const uploadBanner = await import('@/app/api/upload-banner/route');
const fetchCsv     = await import('@/app/api/fetch-csv/route');
const download     = await import('@/app/api/download/route');
const debugRoute   = await import('@/app/api/debug/route');

beforeEach(() => { currentSession = null; });

const req = (method = 'POST') => new Request('http://x/', { method });

describe('API route 授權', () => {
  it('viewer 打 /api/upload → 403，不碰 R2', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    expect((await upload.POST(req(), {})).status).toBe(403);
  });

  it('viewer 打 /api/upload-banner → 403', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    expect((await uploadBanner.POST(req(), {})).status).toBe(403);
  });

  it('viewer 打 /api/fetch-csv → 403', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    expect((await fetchCsv.POST(req(), {})).status).toBe(403);
  });

  // Rock 裁定：viewer 不得匯出
  it('viewer 打 /api/download → 403（Rock 重裁：viewer 不得開附件）', async () => {
    currentSession = { userId: 'v1', role: 'viewer' };
    expect((await download.GET(req('GET'), {})).status).toBe(403);
  });

  it('admin 打 /api/debug → 403（只有 super_admin）', async () => {
    currentSession = { userId: 'a1', role: 'admin' };
    expect((await debugRoute.GET(req('GET'), {})).status).toBe(403);
  });

  it('未登入打任何寫入 route → 401', async () => {
    currentSession = null;
    expect((await upload.POST(req(), {})).status).toBe(401);
    expect((await download.GET(req('GET'), {})).status).toBe(401);
  });
});
