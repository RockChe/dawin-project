import { getInitialData } from '@/server/actions/dashboard';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard/Dashboard';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const data = await getInitialData();
  if (data?.error) redirect('/login');

  return (
    <ErrorBoundary>
      <Dashboard initialData={data} />
    </ErrorBoundary>
  );
}
