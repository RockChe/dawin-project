'use client';

import { useActionState, useEffect } from 'react';
import { setPassword } from '@/server/actions/auth';
import { useTheme } from '@/components/ThemeProvider';
import { F } from '@/lib/theme';

export default function SetPasswordPage() {
  const [state, formAction, isPending] = useActionState(setPassword, null);
  const { X } = useTheme();

  useEffect(() => {
    if (state?.success && state?.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(160deg, ${X.bg}, ${X.isDark ? '#141820' : '#EDE9E0'})`, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F }}>
      <div className="w-full max-w-md p-8 rounded-2xl shadow-lg" style={{ background: X.surface, width: '100%', maxWidth: 448, padding: 32, borderRadius: 16, boxShadow: X.modalShadow, border: `1px solid ${X.border}` }}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: X.text }}>設定新密碼</h1>
          <p className="mt-2 text-sm" style={{ color: X.textSec }}>請設定您的新密碼以繼續使用</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: `${X.red}15`, color: X.red }}>
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="p-3 rounded-lg text-sm" style={{ background: `${X.green}15`, color: X.green }}>
              密碼設定成功，正在跳轉...
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: X.text }}>新密碼</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${X.border}`, color: X.text, background: X.surface }}
              onFocus={e => e.target.style.borderColor = X.accent}
              onBlur={e => e.target.style.borderColor = X.border}
              placeholder="至少 8 個字元"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: X.text }}>確認密碼</label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${X.border}`, color: X.text, background: X.surface }}
              onFocus={e => e.target.style.borderColor = X.accent}
              onBlur={e => e.target.style.borderColor = X.border}
              placeholder="再次輸入密碼"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || state?.success}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: X.accent, opacity: (isPending || state?.success) ? 0.7 : 1 }}
          >
            {isPending ? '設定中...' : state?.success ? '跳轉中...' : '設定密碼'}
          </button>
        </form>
      </div>
    </div>
  );
}
