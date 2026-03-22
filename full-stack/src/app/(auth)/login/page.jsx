'use client';

import { useActionState, useEffect } from 'react';
import { login } from '@/server/actions/auth';
import { useTheme } from '@/components/ThemeProvider';
import { F } from '@/lib/theme';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);
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
          <h1 className="text-2xl font-bold" style={{ color: X.text }}>專案管理儀表板</h1>
          <p className="mt-2 text-sm" style={{ color: X.textSec }}>請登入以繼續</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: `${X.red}15`, color: X.red }}>
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="p-3 rounded-lg text-sm" style={{ background: `${X.green}15`, color: X.green }}>
              登入成功，正在跳轉...
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: X.text }}>Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ border: `1px solid ${X.border}`, color: X.text, background: X.surface }}
              onFocus={e => e.target.style.borderColor = X.accent}
              onBlur={e => e.target.style.borderColor = X.border}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: X.text }}>密碼</label>
            <input
              name="password"
              type="password"
              required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ border: `1px solid ${X.border}`, color: X.text, background: X.surface }}
              onFocus={e => e.target.style.borderColor = X.accent}
              onBlur={e => e.target.style.borderColor = X.border}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || state?.success}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity"
            style={{ background: X.accent, opacity: (isPending || state?.success) ? 0.7 : 1 }}
          >
            {isPending ? '登入中...' : state?.success ? '跳轉中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
