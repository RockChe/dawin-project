'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserSettings, setUserSetting } from '@/server/actions/userSettings';
import useForbiddenHandler from './useForbiddenHandler';

/**
 * @param initial 伺服器隨首屏（getInitialData）帶來的設定。有給（含 {}）就直接當起始狀態、
 *   ready 一開始即 true、掛載時不再打 getUserSettings；沒給才維持舊行為（掛載後 fetch）。
 *   SSR 與 client 首次 render 拿到同一份 props，所以不會 hydration mismatch。
 */
export default function useUserSettings(defaults = {}, showToast, initial) {
  const handleForbidden = useForbiddenHandler(showToast || (() => {}));
  const hasInitial = initial != null;
  const [settings, setSettings] = useState(() => (hasInitial ? { ...defaults, ...initial } : defaults));
  const [ready, setReady] = useState(hasInitial);
  // Keep a ref to the latest settings so we can read current value synchronously
  // before any async gap (needed for optimistic-update rollback).
  const settingsRef = useRef(settings);

  // Sync ref whenever state changes
  useEffect(() => {
    settingsRef.current = settings;
  });

  useEffect(() => {
    if (hasInitial) return;
    // ready flips on success AND failure so a caller gating on it never hangs.
    getUserSettings()
      .then(res => { if (res?.success) setSettings(s => ({ ...s, ...res.data })); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 只在掛載時決定一次

  const update = useCallback(async (key, value) => {
    // Capture previous value synchronously via ref (before the async gap)
    const prev = settingsRef.current;
    // Optimistic update
    setSettings(s => ({ ...s, [key]: value }));
    const res = await setUserSetting(key, value);
    // Rollback on error — key-scoped so a failed update for one key doesn't
    // clobber other keys' concurrent optimistic updates.
    if (res?.error) {
      setSettings(s => ({ ...s, [key]: prev[key] }));
      handleForbidden(res);
    }
    return res;
  }, [handleForbidden]);

  return { settings, updateSetting: update, ready };
}
