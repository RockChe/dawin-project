import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const useForbiddenHandler = (await import('@/hooks/useForbiddenHandler')).default;

describe('useForbiddenHandler', () => {
  it('FORBIDDEN → 提示並 refresh，回傳 true', () => {
    const toast = vi.fn();
    const { result } = renderHook(() => useForbiddenHandler(toast));
    expect(result.current({ error: 'FORBIDDEN' })).toBe(true);
    expect(toast).toHaveBeenCalledWith('權限不足', 'error');
    expect(refresh).toHaveBeenCalled();
  });

  it('其他錯誤不處理，回傳 false', () => {
    const toast = vi.fn();
    const { result } = renderHook(() => useForbiddenHandler(toast));
    expect(result.current({ error: '別的錯' })).toBe(false);
    expect(result.current({ success: true })).toBe(false);
    expect(result.current(undefined)).toBe(false);
  });
});
