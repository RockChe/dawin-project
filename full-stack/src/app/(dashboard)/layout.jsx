import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/dashboard/Sidebar';

export const dynamic = 'force-dynamic';

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
    <div className="flex min-h-screen">
      <Sidebar user={session} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
