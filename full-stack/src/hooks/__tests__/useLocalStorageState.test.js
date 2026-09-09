/**
 * TDD tests for useLocalStorageState.
 *
 * Root cause: five useState initializers in Dashboard.jsx read localStorage
 * directly inside the initializer function. useState initializers run during
 * SSR too — the server has no localStorage, so it falls back to the default,
 * while the client reads the stored value, producing a hydration mismatch.
 *
 * The fix: initial value is always defaultValue (SSR-safe); localStorage is
 * only read after mount, inside useEffect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const { default: useLocalStorageState } = await import('@/hooks/useLocalStorageState');

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useLocalStorageState', () => {
  it('SSR-safe: server render (no localStorage, no effects) always yields defaultValue', () => {
    // renderToStaticMarkup mirrors what Next.js does on the server: no
    // effects run, and there is no localStorage global at all. This is the
    // exact scenario that caused the hydration mismatch — if the hook's
    // initial state ever depended on localStorage, this would throw or
    // render the wrong value.
    const originalLS = globalThis.localStorage;
    delete globalThis.localStorage;
    function Comp() {
      const [value] = useLocalStorageState('k', 'default-value', (raw) => raw);
      return createElement('span', null, value);
    }
    let html;
    expect(() => { html = renderToStaticMarkup(createElement(Comp)); }).not.toThrow();
    expect(html).toContain('default-value');
    globalThis.localStorage = originalLS;
  });

  it('reads from localStorage after mount', async () => {
    localStorage.setItem('k', 'stored-value');
    const { result } = renderHook(() => useLocalStorageState('k', 'default-value', (raw) => raw));
    await act(async () => {});
    expect(result.current[0]).toBe('stored-value');
  });

  it('keeps defaultValue when parse returns undefined', async () => {
    localStorage.setItem('k', 'garbage');
    const { result } = renderHook(() =>
      useLocalStorageState('k', 'default-value', (raw) => (raw === 'valid' ? raw : undefined))
    );
    await act(async () => {});
    expect(result.current[0]).toBe('default-value');
  });

  it('setter writes the new value into localStorage', async () => {
    const { result } = renderHook(() => useLocalStorageState('k', 'default-value', (raw) => raw));
    await act(async () => {});
    act(() => {
      result.current[1]('new-value');
    });
    expect(result.current[0]).toBe('new-value');
    expect(localStorage.getItem('k')).toBe('new-value');
  });

  it('setter JSON-stringifies non-string values', async () => {
    const { result } = renderHook(() => useLocalStorageState('k', { a: 1 }, (raw) => JSON.parse(raw)));
    await act(async () => {});
    act(() => {
      result.current[1]({ a: 2 });
    });
    expect(localStorage.getItem('k')).toBe(JSON.stringify({ a: 2 }));
  });

  it('does not throw when localStorage.getItem throws on mount (e.g. Safari private mode)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => useLocalStorageState('k', 'default-value', (raw) => raw));
    await act(async () => {});
    expect(result.current[0]).toBe('default-value');
  });

  it('does not throw when localStorage.setItem throws on write (e.g. Safari private mode)', async () => {
    const { result } = renderHook(() => useLocalStorageState('k', 'default-value', (raw) => raw));
    await act(async () => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => {
      act(() => {
        result.current[1]('new-value');
      });
    }).not.toThrow();
    expect(result.current[0]).toBe('new-value');
  });
});
