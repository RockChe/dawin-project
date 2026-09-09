"use client";
import { useState, useEffect, useCallback } from 'react';

/**
 * 跟 useState 一樣，但值會存進 localStorage。
 *
 * 關鍵：**初始值一律用 defaultValue**，不在 initializer 裡讀 localStorage。
 * useState 的 initializer 在 SSR 也會跑，伺服器沒有 localStorage，
 * 兩邊算出不同的初始值就會 hydration mismatch。
 * 改成掛載後才從 localStorage 覆蓋——代價是第一幀會閃一下預設值，
 * 換來 hydration 一致（React 19 對 mismatch 是整棵樹重建，比閃一下貴得多）。
 *
 * @param key localStorage 的 key
 * @param defaultValue SSR 與首次渲染用的值
 * @param parse 從字串還原成值；回 undefined 表示存的值無效、要用預設值
 */
export default function useLocalStorageState(key, defaultValue, parse) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const parsed = parse ? parse(raw) : raw;
      if (parsed !== undefined) setValue(parsed);
    } catch {}
    // 只在掛載時讀一次
  }, [key]);  // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((v) => {
    setValue(v);
    try { localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v)); } catch {}
  }, [key]);

  return [value, set];
}
