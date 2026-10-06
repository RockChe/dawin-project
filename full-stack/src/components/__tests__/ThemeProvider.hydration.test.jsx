import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';

function Probe() {
  const { themeKey, X } = useTheme();
  return <div id="probe" data-theme={themeKey} style={{ background: X.bg }}>{themeKey}</div>;
}
const app = <ThemeProvider><Probe /></ThemeProvider>;

// SSR 沒有 localStorage；client 有。模擬「深色使用者」從伺服器拿到 HTML 後 hydrate。
async function ssrThenHydrate(stored) {
  vi.stubGlobal('localStorage', undefined);
  const html = renderToString(app);
  const store = { 'dash-theme': stored };
  vi.stubGlobal('localStorage', {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  });
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
  const recoverable = [];
  let root;
  await act(async () => {
    root = hydrateRoot(container, app, { onRecoverableError: (e) => recoverable.push(String(e?.message || e)) });
  });
  spy.mockRestore();
  return { container, store, errors, recoverable, root };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

describe('ThemeProvider hydration', () => {
  it('深色使用者：hydrate 不產生 mismatch，且最終切到 dimmed 並保留 localStorage', async () => {
    const { container, store, errors, recoverable } = await ssrThenHydrate('dimmed');
    expect([...errors, ...recoverable].filter((m) => /hydrat/i.test(m))).toEqual([]);
    const el = container.querySelector('#probe');
    expect(el.dataset.theme).toBe('dimmed');
    expect(el.style.background).toBe('rgb(26, 30, 38)');
    expect(store['dash-theme']).toBe('dimmed');
    expect(document.body.style.background).toBe('rgb(26, 30, 38)');
  });

  it('localStorage 存了未知值：退回 warm 並不 crash', async () => {
    const { container, errors, recoverable } = await ssrThenHydrate('dark');
    expect([...errors, ...recoverable].filter((m) => /hydrat/i.test(m))).toEqual([]);
    expect(container.querySelector('#probe').dataset.theme).toBe('warm');
  });
});
