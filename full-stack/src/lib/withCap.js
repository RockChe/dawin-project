// 授權是「包住業務邏輯的一層」，不是「業務邏輯裡的一行」。
// 差別：後者可能被寫在死分支、寫在副作用之後、或忘了檢查回傳的 error；
// 前者在結構上不可能——callback 只有授權通過才會被呼叫。
import { NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import { safeRequireAuth } from '@/lib/auth';

/** Server Action 用。回傳形狀沿用專案慣例：{ error } 或 fn 的回傳值。 */
export async function withCap(cap, fn) {
  const { session, error } = await safeRequireAuth();
  if (error) return { error };
  if (!can(session.role, cap)) return { error: 'FORBIDDEN' };
  return fn(session);
}

/** API Route 用。回傳 NextResponse。 */
export function withRouteCap(cap, handler) {
  return async (request, ctx) => {
    const { session, error } = await safeRequireAuth();
    if (error) return NextResponse.json({ error }, { status: 401 });
    if (!can(session.role, cap)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return handler(request, ctx, session);
  };
}
