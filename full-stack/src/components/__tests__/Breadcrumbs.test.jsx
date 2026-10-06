import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import Breadcrumbs from '../Breadcrumbs';

const setup = (items, props) => render(<ThemeProvider><Breadcrumbs items={items} {...props} /></ThemeProvider>);

describe('Breadcrumbs', () => {
  it('是 nav[aria-label=breadcrumb] 內的 ol', () => {
    setup([{ label: '首頁', onClick: () => {} }, { label: 'Projects' }]);
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav.querySelector('ol')).toBeTruthy();
    expect(nav.querySelectorAll('li').length).toBe(2);
  });
  it('最後一項 aria-current=page 且不是按鈕／連結', () => {
    setup([{ label: '首頁', onClick: () => {} }, { label: 'Projects' }]);
    const cur = screen.getByText('Projects');
    expect(cur.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Projects' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Projects' })).toBeNull();
  });
  it('祖先 onClick → button，點擊觸發', () => {
    const onClick = vi.fn();
    setup([{ label: '首頁', onClick }, { label: 'Projects' }]);
    fireEvent.click(screen.getByRole('button', { name: '首頁' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('祖先 href → a[href]', () => {
    setup([{ label: '首頁', href: '/dashboard' }, { label: '備份' }]);
    expect(screen.getByRole('link', { name: '首頁' }).getAttribute('href')).toBe('/dashboard');
  });
  it('分隔符 › 標 aria-hidden，n 項只有 n-1 個', () => {
    const { container } = setup([{ label: 'a', onClick() {} }, { label: 'b', onClick() {} }, { label: 'c' }]);
    const seps = container.querySelectorAll('[aria-hidden="true"]');
    expect(seps.length).toBe(2);
    expect(seps[0].textContent).toBe('›');
  });
  it('單一項：只有當前頁，沒有分隔符', () => {
    const { container } = setup([{ label: '首頁' }]);
    expect(screen.getByText('首頁').getAttribute('aria-current')).toBe('page');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });
  it('祖先沒給 onClick／href 時退成純文字（不是死按鈕）', () => {
    setup([{ label: '首頁' }, { label: 'X' }]);
    expect(screen.queryByRole('button', { name: '首頁' })).toBeNull();
    expect(screen.queryByRole('link', { name: '首頁' })).toBeNull();
  });
  it('items 為空 → 不渲染', () => {
    const { container } = setup([]);
    expect(container.querySelector('nav')).toBeNull();
  });
  it('mobile 變體：可點項目高度 >= 44', () => {
    setup([{ label: '首頁', onClick() {} }, { label: 'x' }], { size: 'mobile' });
    expect(screen.getByRole('button', { name: '首頁' }).style.minHeight).toBe('44px');
  });
});
