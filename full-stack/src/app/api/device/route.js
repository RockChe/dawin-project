import { NextResponse } from 'next/server';
import { DEVICES, ENABLED_DEVICES, HOME } from '@/lib/device';

// 手動切換版本：寫 device_pref，導向該版首頁。目的地只能是 HOME 表內的固定路徑，不接受 next 參數。
export async function GET(request) {
  const to = request.nextUrl.searchParams.get('to');
  if (!DEVICES.includes(to) || !ENABLED_DEVICES.includes(to)) {
    return NextResponse.json({ error: 'invalid device' }, { status: 400 });
  }
  const res = NextResponse.redirect(new URL(HOME[to], request.url));
  res.cookies.set('device_pref', to, {
    path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
