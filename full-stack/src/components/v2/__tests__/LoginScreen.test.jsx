import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useActionState } from 'react';
import { CloudLevelProvider } from '@/components/CloudLevelContext';
import LoginScreen, { loginTarget } from '@/components/v2/LoginScreen';

vi.mock('@/server/actions/auth', () => ({ login: vi.fn() }));
vi.mock('react', async (orig) => ({ ...(await orig()), useActionState: vi.fn() }));

const assign = vi.fn();
const setState = (state, pending = false) => useActionState.mockReturnValue([state, vi.fn(), pending]);

beforeEach(() => {
  assign.mockClear();
  setState(null);
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('v2 LoginScreen', () => {
  it('五朵雲同框（白雲／粉紅雲／淡紫雲／烏雲／筋斗雲），標題與歡迎文案', () => {
    const { container } = render(<LoginScreen />);
    const names = [...container.querySelectorAll('.five .cl svg title')].map((t) => t.textContent);
    expect(names).toEqual(['白雲', '粉紅雲', '淡紫雲', '烏雲', '筋斗雲']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('大雲文創專案管理系統');
    expect(screen.getByText('歡迎回來，大雲的夥伴')).toBeTruthy();
    expect(container.textContent).not.toMatch(/雲寶寶/);
  });

  it('登入表單：Email／密碼／登入鈕，沿用 login action 的欄位名稱', () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText('Email').getAttribute('name')).toBe('email');
    expect(screen.getByLabelText('密碼').getAttribute('name')).toBe('password');
    expect(screen.getByRole('button', { name: '登入' })).toBeTruthy();
  });

  it('雲朵關閉：退回品牌 Logo「P」，不畫任何雲', () => {
    const { container } = render(<CloudLevelProvider level="off"><LoginScreen /></CloudLevelProvider>);
    expect(container.querySelector('.five svg')).toBeNull();
    expect(container.querySelector('.five .bigp').textContent).toBe('P');
  });

  it('失敗訊息以 alert 顯示；送出中按鈕停用', () => {
    setState({ error: '帳號或密碼錯誤' }, true);
    render(<LoginScreen />);
    expect(screen.getByRole('alert').textContent).toBe('帳號或密碼錯誤');
    expect(screen.getByRole('button', { name: '登入中...' }).disabled).toBe(true);
  });

  it('成功導向 /v2；需改密碼導 /set-password', () => {
    expect(loginTarget('/')).toBe('/v2');
    expect(loginTarget(undefined)).toBe('/v2');
    expect(loginTarget('/set-password')).toBe('/set-password');
    setState({ success: true, redirectTo: '/' });
    render(<LoginScreen />);
    expect(assign).toHaveBeenCalledWith('/v2');
  });

  it('需改密碼的成功回應 → /set-password', () => {
    setState({ success: true, redirectTo: '/set-password' });
    render(<LoginScreen />);
    expect(assign).toHaveBeenCalledWith('/set-password');
  });
});

describe('v2.css 字級', () => {
  it('所有 font-size／font 簡寫的 px 值 ≥ 14（最小字 14px）', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/v2.css'), 'utf8');
    const small = [];
    for (const m of css.matchAll(/(?<![\w-])font(?:-size)?\s*:\s*([^;}]+)/g)) {
      for (const n of m[1].matchAll(/(\d+(?:\.\d+)?)px/g)) if (parseFloat(n[1]) < 14) small.push(m[0]);
    }
    expect(small).toEqual([]);
  });
});
