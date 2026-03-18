import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/dashboard/Sidebar';

export default async function AdminLayout({ children }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'super_admin') {
    redirect('/dashboard');
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
