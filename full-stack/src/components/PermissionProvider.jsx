"use client";
import { createContext, useContext, useMemo } from 'react';
import { can } from '@/lib/permissions';

// 預設 null role → 所有 can() 都是 false。沒包 Provider 時 fail-closed。
const PermissionContext = createContext(null);

export function PermissionProvider({ role, children }) {
  const value = useMemo(() => ({ role }), [role]);
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function useCan(cap) {
  const ctx = useContext(PermissionContext);
  return can(ctx?.role, cap);
}
