import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Home() {
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

  // Redirect to dashboard
  redirect('/dashboard');
}
