import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PermissionProvider, useCan } from '@/components/PermissionProvider';

const wrap = (role) => ({ children }) => (
  <PermissionProvider role={role}>{children}</PermissionProvider>
);

describe('useCan', () => {
  it('viewer 不能寫', () => {
    expect(renderHook(() => useCan('write'), { wrapper: wrap('viewer') }).result.current).toBe(false);
  });
  it('viewer 可以讀', () => {
    expect(renderHook(() => useCan('read'), { wrapper: wrap('viewer') }).result.current).toBe(true);
  });
  it('admin 可以寫', () => {
    expect(renderHook(() => useCan('write'), { wrapper: wrap('admin') }).result.current).toBe(true);
  });
  it('admin 不能 manage', () => {
    expect(renderHook(() => useCan('manage'), { wrapper: wrap('admin') }).result.current).toBe(false);
  });
  // role 還沒載入時不能閃出編輯按鈕
  it('role 為 null 時一律 false（避免 hydration 前閃現編輯 UI）', () => {
    expect(renderHook(() => useCan('write'), { wrapper: wrap(null) }).result.current).toBe(false);
  });
  it('沒有 Provider 時一律 false（fail-closed）', () => {
    expect(renderHook(() => useCan('write')).result.current).toBe(false);
  });
});
