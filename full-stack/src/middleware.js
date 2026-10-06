import { NextResponse, userAgent } from 'next/server';
import { detectDevice, HOME } from '@/lib/device';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow POST to /api/backup (cron uses CRON_SECRET, not session)
  if (pathname.startsWith('/api/backup') && request.method === 'POST') {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|eot|ttf|otf|map|json)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 裝置分流：只攔 GET /dashboard（預設入口）。直接開 /m、/t 是明確選擇，永遠尊重。
  if (request.method === 'GET' && pathname === '/dashboard') {
    const device = detectDevice({
      uaType: userAgent(request).device.type,
      pref: request.cookies.get('device_pref')?.value,
      auto: request.cookies.get('device_auto')?.value,
    });
    if (device !== 'desktop') {
      return NextResponse.redirect(new URL(HOME[device], request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
