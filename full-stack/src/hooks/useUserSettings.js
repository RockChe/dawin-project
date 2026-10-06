'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserSettings, setUserSetting } from '@/server/actions/userSettings';
import useForbiddenHandler from './useForbiddenHandler';

export default function useUserSettings(defaults = {}, showToast) {
  const handleForbidden = useForbiddenHandler(showToast || (() => {}));
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  // Keep a ref to the latest settings so we can read current value synchronously
  // before any async gap (needed for optimistic-update rollback).
  const settingsRef = useRef(settings);

  // Sync ref whenever state changes
  useEffect(() => {
    settingsRef.current = settings;
  });

  useEffect(() => {
    // ready flips on success AND failure so a caller gating on it never hangs.
    getUserSettings()
      .then(res => { if (res?.success) setSettings(s => ({ ...s, ...res.data })); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

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
