import { getProjectWithTasks } from '@/server/actions/projects';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/dashboard/ProjectDetail';

export default async function ProjectPage({ params }) {
  const { id } = await params;
  const data = await getProjectWithTasks(id);

  if (!data) {
    notFound();
  }

  return <ProjectDetail initialData={data} />;
}
