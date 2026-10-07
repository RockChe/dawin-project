import { describe, it, expect, vi } from 'vitest';
import { makeBannerActions } from '@/lib/v2Banner';

// 專案頭像上傳／刪除：沿用舊 ProjectsTab 的流程（POST /api/upload-banner、deleteProjectBanner action），
// 樂觀更新 → 成功換成伺服器網址、失敗回復＋toast。fetch／action 全部 mock，不碰網路與 DB。
const file = new File(['x'], 'a.png', { type: 'image/png' });
const setup = (over = {}) => {
  let projects = [{ id: 'p1', name: 'A', bannerUrl: 'old.png' }, { id: 'p2', name: 'B', bannerUrl: null }];
  const setProjects = vi.fn((fn) => { projects = fn(projects); });
  const showToast = vi.fn();
  const onForbidden = vi.fn(() => false);
  const fetchFn = vi.fn(async () => ({ json: async () => ({ success: true, bannerUrl: 'https://r2/new.png' }) }));
  const deleteBanner = vi.fn(async () => ({ success: true }));
  const api = makeBannerActions({ setProjects, showToast, onForbidden, fetchFn, deleteBanner, getProjects: () => projects, ...over });
  return { api, get: () => projects, showToast, onForbidden: over.onForbidden ?? onForbidden, fetchFn, deleteBanner };
};
const url = (s, id) => s.get().find((p) => p.id === id).bannerUrl;

describe('makeBannerActions.upload', () => {
  it('POST /api/upload-banner（FormData：file＋projectId），成功換成伺服器網址並 toast 成功', async () => {
    const s = setup();
    await s.api.upload('p2', file);
    expect(s.fetchFn).toHaveBeenCalledTimes(1);
    const [path, init] = s.fetchFn.mock.calls[0];
    expect(path).toBe('/api/upload-banner');
    expect(init.method).toBe('POST');
    expect(init.body.get('projectId')).toBe('p2');
    expect(init.body.get('file')).toBeInstanceOf(File);
    expect(url(s, 'p2')).toBe('https://r2/new.png');
    expect(s.showToast).toHaveBeenCalledWith('圖示已上傳', 'success');
  });
  it('上傳期間先顯示本機預覽（data URL）', async () => {
    let seen;
    const s = setup({ fetchFn: vi.fn(async () => { seen = url(s, 'p2'); return { json: async () => ({ bannerUrl: 'u' }) }; }) });
    await s.api.upload('p2', file);
    expect(seen).toMatch(/^data:/);
  });
  it('伺服器回 error → 回復原圖、toast 錯誤文字', async () => {
    const s = setup({ fetchFn: vi.fn(async () => ({ json: async () => ({ error: '無權限修改此專案' }) })) });
    await s.api.upload('p1', file);
    expect(url(s, 'p1')).toBe('old.png');
    expect(s.showToast).toHaveBeenCalledWith('無權限修改此專案', 'error');
  });
  it('FORBIDDEN 交給 onForbidden 處理，不再吵錯誤 toast', async () => {
    const s = setup({ fetchFn: vi.fn(async () => ({ json: async () => ({ error: 'FORBIDDEN' }) })), onForbidden: vi.fn(() => true) });
    await s.api.upload('p1', file);
    expect(s.onForbidden).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
    expect(s.showToast).not.toHaveBeenCalled();
    expect(url(s, 'p1')).toBe('old.png');
  });
  it('網路例外 → 回復、toast「圖示上傳失敗」', async () => {
    const s = setup({ fetchFn: vi.fn(async () => { throw new Error('net'); }) });
    await s.api.upload('p2', file);
    expect(url(s, 'p2')).toBeNull();
    expect(s.showToast).toHaveBeenCalledWith('圖示上傳失敗', 'error');
  });
  it('沒選檔案不做事', async () => {
    const s = setup();
    await s.api.upload('p1', undefined);
    expect(s.fetchFn).not.toHaveBeenCalled();
  });
});

describe('makeBannerActions.remove', () => {
  it('樂觀清掉 → deleteProjectBanner(id) → toast「圖示已刪除」', async () => {
    const s = setup();
    await s.api.remove('p1');
    expect(s.deleteBanner).toHaveBeenCalledWith('p1');
    expect(url(s, 'p1')).toBeNull();
    expect(s.showToast).toHaveBeenCalledWith('圖示已刪除', 'success');
  });
  it('失敗 → 回復原圖＋toast 錯誤；FORBIDDEN 不再 toast', async () => {
    const s = setup({ deleteBanner: vi.fn(async () => ({ error: '刪除 Banner 失敗' })) });
    await s.api.remove('p1');
    expect(url(s, 'p1')).toBe('old.png');
    expect(s.showToast).toHaveBeenCalledWith('刪除 Banner 失敗', 'error');
    const f = setup({ deleteBanner: vi.fn(async () => ({ error: 'FORBIDDEN' })), onForbidden: vi.fn(() => true) });
    await f.api.remove('p1');
    expect(f.showToast).not.toHaveBeenCalled();
    expect(url(f, 'p1')).toBe('old.png');
  });
});
