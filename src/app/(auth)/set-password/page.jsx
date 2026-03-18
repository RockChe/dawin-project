'use client';

import { useActionState } from 'react';
import { setPassword } from '@/server/actions/auth';

export default function SetPasswordPage() {
  const [state, formAction, isPending] = useActionState(setPassword, null);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F3EF' }}>
      <div className="w-full max-w-md p-8 rounded-2xl shadow-lg" style={{ background: '#FFFFFF' }}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#37352F' }}>設定新密碼</h1>
          <p className="mt-2 text-sm" style={{ color: '#6B6B6B' }}>請設定您的新密碼以繼續使用</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#EB575715', color: '#EB5757' }}>
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#37352F' }}>新密碼</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #E3E2DE', color: '#37352F' }}
              onFocus={e => e.target.style.borderColor = '#2383E2'}
              onBlur={e => e.target.style.borderColor = '#E3E2DE'}
              placeholder="至少 8 個字元"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#37352F' }}>確認密碼</label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #E3E2DE', color: '#37352F' }}
              onFocus={e => e.target.style.borderColor = '#2383E2'}
              onBlur={e => e.target.style.borderColor = '#E3E2DE'}
              placeholder="再次輸入密碼"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#2383E2', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? '設定中...' : '設定密碼'}
          </button>
        </form>
      </div>
    </div>
  );
}
