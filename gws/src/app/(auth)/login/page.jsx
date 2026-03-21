'use client';

import { useActionState, useEffect } from 'react';
import { login } from '@/server/actions/auth';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  useEffect(() => {
    if (state?.success && state?.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F3EF' }}>
      <div className="w-full max-w-md p-8 rounded-2xl shadow-lg" style={{ background: '#FFFFFF' }}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#37352F' }}>專案管理儀表板</h1>
          <p className="mt-2 text-sm" style={{ color: '#6B6B6B' }}>請登入以繼續</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#EB575715', color: '#EB5757' }}>
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#00B87C15', color: '#00B87C' }}>
              登入成功，正在跳轉...
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#37352F' }}>Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ border: '1px solid #E3E2DE', color: '#37352F', background: '#FFFFFF' }}
              onFocus={e => e.target.style.borderColor = '#2383E2'}
              onBlur={e => e.target.style.borderColor = '#E3E2DE'}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#37352F' }}>密碼</label>
            <input
              name="password"
              type="password"
              required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ border: '1px solid #E3E2DE', color: '#37352F', background: '#FFFFFF' }}
              onFocus={e => e.target.style.borderColor = '#2383E2'}
              onBlur={e => e.target.style.borderColor = '#E3E2DE'}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || state?.success}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity"
            style={{ background: '#2383E2', opacity: (isPending || state?.success) ? 0.7 : 1 }}
          >
            {isPending ? '登入中...' : state?.success ? '跳轉中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
