import { redirect } from 'next/navigation';
import { getInitialData } from '@/server/actions/dashboard';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';
import MobileApp from '@/components/mobile/MobileApp';

export const dynamic = 'force-dynamic';

export default async function MobilePage() {
  const data = await getInitialData();
  if (data?.error) redirect('/login');
  return <ErrorBoundary><MobileApp initialData={data} /></ErrorBoundary>;
}
