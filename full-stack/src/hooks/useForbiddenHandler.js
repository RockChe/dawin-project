"use client";
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * 收到 FORBIDDEN 時：提示 + refresh。
 * refresh 是為了處理「被降級成 viewer，但 SSR 快照裡的 role 還是舊的」——
 * 不 refresh 的話畫面會一直顯示編輯 UI，然後每點一次跳一個錯誤。
 * 回傳 true 表示「已處理，呼叫端不用再管」。
 */
export default function useForbiddenHandler(showToast) {
  const router = useRouter();
  return useCallback((result) => {
    if (result?.error !== 'FORBIDDEN') return false;
    showToast('權限不足', 'error');
    router.refresh();
    return true;
  }, [router, showToast]);
}
