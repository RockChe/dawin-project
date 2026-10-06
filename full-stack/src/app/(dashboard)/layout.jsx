import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/dashboard/Sidebar';

export const dynamic = 'force-dynamic';

// 固定桌機版：手機／平板以 1280 寬渲染後縮放（可雙指放大）；平板／手機版另行設計。
export const viewport = { width: 1280 };

export default async function DashboardLayout({ children }) {
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

  return (
    <div className="flex min-h-screen" style={{ minWidth: 1280 }}>
      <Sidebar user={session} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
