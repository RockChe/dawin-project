"use client";
import { useSyncExternalStore } from "react";

// 系統「減少動態」偏好（prefers-reduced-motion: reduce）。伺服器端與 hydration 一律 false，掛載後才讀真值。
const Q = "(prefers-reduced-motion: reduce)";
const subscribe = (cb) => {
  const m = window.matchMedia?.(Q);
  m?.addEventListener?.("change", cb);
  return () => m?.removeEventListener?.("change", cb);
};
export default function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => !!window.matchMedia?.(Q)?.matches, () => false);
}
