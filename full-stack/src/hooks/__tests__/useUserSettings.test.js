/**
 * TDD tests for useUserSettings hook.
 *
 * Mocks @/server/actions/userSettings so no DB or server is involved.
 * Uses renderHook + act from @testing-library/react.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mock server actions ───────────────────────────────────────────────────
const mockGetUserSettings = vi.fn();
const mockSetUserSetting = vi.fn();

vi.mock('@/server/actions/userSettings', () => ({
  getUserSettings: mockGetUserSettings,
  setUserSetting: mockSetUserSetting,
}));

// useUserSettings now runs FORBIDDEN results through useForbiddenHandler,
// which calls next/navigation's useRouter() — not mounted in a bare
// renderHook, so stub it the same way forbiddenHandler.test.js does.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// ── Import under test ─────────────────────────────────────────────────────
const { default: useUserSettings } = await import('@/hooks/useUserSettings');

// ── Tests ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. On mount, loads settings from getUserSettings ──────────────────────
describe('initial load', () => {
  it('merges server settings into state on mount', async () => {
    mockGetUserSettings.mockResolvedValue({ success: true, data: { zoom: 150, theme: 'dark' } });

    const { result } = renderHook(() => useUserSettings({ zoom: 100 }));

    // Wait for the effect to settle
    await act(async () => {});

    expect(result.current.settings.zoom).toBe(150);
    expect(result.current.settings.theme).toBe('dark');
  });

  it('keeps defaults when server returns no data', async () => {
    mockGetUserSettings.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useUserSettings({ zoom: 100 }));
    await act(async () => {});

    expect(result.current.settings.zoom).toBe(100);
  });
});

// ── 2. updateSetting optimistic update + rollback on error ────────────────
describe('updateSetting', () => {
  it('optimistically updates state immediately', async () => {
    mockGetUserSettings.mockResolvedValue({ success: true, data: {} });
    // setUserSetting resolves (slowly) successfully
    mockSetUserSetting.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 50))
    );

    const { result } = renderHook(() => useUserSettings({ zoom: 100 }));
    await act(async () => {});

    // Start update but don't await it yet
    act(() => {
      result.current.updateSetting('zoom', 200);
    });

    // State should already be updated optimistically
    expect(result.current.settings.zoom).toBe(200);
  });

  it('rolls back to previous value when setUserSetting returns error', async () => {
    mockGetUserSettings.mockResolvedValue({ success: true, data: { zoom: 100 } });
    mockSetUserSetting.mockResolvedValue({ error: 'DB error' });

    const { result } = renderHook(() => useUserSettings({}));
    // Wait for initial load to settle (zoom: 100 from server)
    await act(async () => {});

    // Should be 100 from server
    expect(result.current.settings).toMatchObject({ zoom: 100 });

    // Update fails → should roll back to the value before the optimistic update
    await act(async () => {
      await result.current.updateSetting('zoom', 999);
    });

    expect(result.current.settings.zoom).toBe(100);
  });

  it('key-scoped rollback: a failed update for one key does not clobber another key', async () => {
    // Server seeds both keys: zoom=100, theme='light'
    mockGetUserSettings.mockResolvedValue({ success: true, data: { zoom: 100, theme: 'light' } });
    // 'theme' update succeeds; 'zoom' update fails → only zoom should roll back
    mockSetUserSetting.mockImplementation((key) =>
      key === 'zoom'
        ? Promise.resolve({ error: 'DB error' })
        : Promise.resolve({ success: true })
    );

    const { result } = renderHook(() => useUserSettings({}));
    await act(async () => {});
    expect(result.current.settings).toMatchObject({ zoom: 100, theme: 'light' });

    // Fire both updates concurrently within one act; zoom fails, theme succeeds
    await act(async () => {
      await Promise.all([
        result.current.updateSetting('theme', 'dark'), // succeeds → keeps 'dark'
        result.current.updateSetting('zoom', 999),      // fails → rolls back to 100
      ]);
    });

    // Failed key rolled back to its prior value...
    expect(result.current.settings.zoom).toBe(100);
    // ...while the other key's successful optimistic update is preserved.
    expect(result.current.settings.theme).toBe('dark');
  });

  it('returns the result from setUserSetting', async () => {
    mockGetUserSettings.mockResolvedValue({ success: true, data: {} });
    mockSetUserSetting.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUserSettings({}));
    await act(async () => {});

    let ret;
    await act(async () => {
      ret = await result.current.updateSetting('key', 'val');
    });

    expect(ret).toEqual({ success: true });
  });
});

// ── 3. ready flag: page must not render with unsaved defaults ─────────────
describe('ready', () => {
  it('is false until getUserSettings resolves, then true with merged settings', async () => {
    let resolve;
    mockGetUserSettings.mockReturnValue(new Promise(r => { resolve = r; }));

    const { result } = renderHook(() => useUserSettings({ zoom: 150 }));
    expect(result.current.ready).toBe(false);

    await act(async () => { resolve({ success: true, data: { zoom: 100 } }); });

    expect(result.current.ready).toBe(true);
    expect(result.current.settings.zoom).toBe(100);
  });

  it('becomes true (keeping defaults) when the server returns success:false', async () => {
    mockGetUserSettings.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useUserSettings({ zoom: 150 }));
    await act(async () => {});
    expect(result.current.ready).toBe(true);
    expect(result.current.settings.zoom).toBe(150);
  });

  it('becomes true when getUserSettings rejects, so the page never hangs', async () => {
    mockGetUserSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useUserSettings({ zoom: 150 }));
    await act(async () => {});
    expect(result.current.ready).toBe(true);
    expect(result.current.settings.zoom).toBe(150);
  });
});

// ── 4. server-provided initial settings (first-load fold-in) ──────────────
describe('initial settings from the server', () => {
  it('starts ready with defaults+initial merged on the very first render, and never calls getUserSettings', async () => {
    const { result } = renderHook(() => useUserSettings({ zoom: 150, a: 1 }, undefined, { zoom: 100 }));
    // 第一次 render 就已就緒：不需 await 任何 effect
    expect(result.current.ready).toBe(true);
    expect(result.current.settings).toEqual({ zoom: 100, a: 1 });
    await act(async () => {});
    expect(mockGetUserSettings).not.toHaveBeenCalled();
  });

  it('an empty initial ({}) still counts as provided: ready, no fetch', async () => {
    const { result } = renderHook(() => useUserSettings({ zoom: 150 }, undefined, {}));
    expect(result.current.ready).toBe(true);
    await act(async () => {});
    expect(mockGetUserSettings).not.toHaveBeenCalled();
  });

  it('updateSetting still works optimistically and rolls back to the initial value', async () => {
    mockSetUserSetting.mockResolvedValue({ error: 'DB error' });
    const { result } = renderHook(() => useUserSettings({}, undefined, { zoom: 100 }));
    await act(async () => { await result.current.updateSetting('zoom', 999); });
    expect(result.current.settings.zoom).toBe(100);
  });

  it('without initial it still fetches on mount (unchanged behaviour)', async () => {
    mockGetUserSettings.mockResolvedValue({ success: true, data: { zoom: 90 } });
    const { result } = renderHook(() => useUserSettings({ zoom: 150 }));
    expect(result.current.ready).toBe(false);
    await act(async () => {});
    expect(mockGetUserSettings).toHaveBeenCalledTimes(1);
    expect(result.current.settings.zoom).toBe(90);
    expect(result.current.ready).toBe(true);
  });
});
