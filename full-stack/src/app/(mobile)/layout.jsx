import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 手機版：跟隨裝置寬度（桌機版才鎖 1280）。
export const viewport = { width: 'device-width', initialScale: 1 };

export default async function MobileLayout({ children }) {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    console.error('Session error:', err);
    redirect('/login');
  }

  if (!session) {
    redirect('/login');
  }

  if (session.mustChangePassword) {
    redirect('/set-password');
  }

  return <div style={{ minHeight: '100dvh' }}>{children}</div>;
}
