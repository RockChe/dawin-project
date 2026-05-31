'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserSettings, setUserSetting } from '@/server/actions/userSettings';

export default function useUserSettings(defaults = {}) {
  const [settings, setSettings] = useState(defaults);
  // Keep a ref to the latest settings so we can read current value synchronously
  // before any async gap (needed for optimistic-update rollback).
  const settingsRef = useRef(settings);

  // Sync ref whenever state changes
  useEffect(() => {
    settingsRef.current = settings;
  });

  useEffect(() => {
    getUserSettings().then(res => { if (res?.success) setSettings(s => ({ ...s, ...res.data })); });
  }, []);

  const update = useCallback(async (key, value) => {
    // Capture previous value synchronously via ref (before the async gap)
    const prev = settingsRef.current;
    // Optimistic update
    setSettings(s => ({ ...s, [key]: value }));
    const res = await setUserSetting(key, value);
    // Rollback on error — key-scoped so a failed update for one key doesn't
    // clobber other keys' concurrent optimistic updates.
    if (res?.error) setSettings(s => ({ ...s, [key]: prev[key] }));
    return res;
  }, []);

  return { settings, updateSetting: update };
}
