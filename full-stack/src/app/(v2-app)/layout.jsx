import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import '@/styles/v2.css';
import V2Root from '@/components/v2/V2Root';

export const dynamic = 'force-dynamic';

// 固定桌機版 1280（沿用 (dashboard) 的做法），不套用也不覆寫共用 zoom。
export const viewport = { width: 1280 };

export default async function V2AppLayout({ children }) {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    console.error('Session error:', err);
    redirect('/v2/login');
  }

  if (!session) {
    redirect('/v2/login');
  }

  if (session.mustChangePassword) {
    redirect('/set-password');
  }

  return <V2Root role={session.role}>{children}</V2Root>;
}
