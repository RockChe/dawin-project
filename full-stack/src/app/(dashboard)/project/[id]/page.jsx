import { getProjectWithTasks } from '@/server/actions/projects';
import { notFound, redirect } from 'next/navigation';
import ProjectDetail from '@/components/dashboard/ProjectDetail';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }) {
  const { id } = await params;
  let data;
  try {
    data = await getProjectWithTasks(id);
  } catch (err) {
    console.error('[ProjectPage] Error:', err.message);
    redirect('/login');
  }

  if (!data || data.error) {
    redirect('/login');
  }

  return <ErrorBoundary><ProjectDetail initialData={data} /></ErrorBoundary>;
}
