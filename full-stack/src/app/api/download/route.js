import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/r2';
import { db } from '@/server/db';
import { files } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const r2Key = searchParams.get('key');

  if (!r2Key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  // Validate key format: must start with "tasks/" or "projects/" and not contain path traversal
  const validPrefix = r2Key.startsWith('tasks/') || r2Key.startsWith('projects/');
  if (!validPrefix || r2Key.includes('..')) {
    return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
  }

  // Verify the record exists in DB
  if (r2Key.startsWith('projects/')) {
    const { projects } = await import('@/server/db/schema');
    const proj = await db.select().from(projects).where(eq(projects.bannerR2Key, r2Key)).limit(1);
    if (!proj[0]) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } else {
    const fileRecord = await db.select().from(files).where(eq(files.r2Key, r2Key)).limit(1);
    if (!fileRecord[0]) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  try {
    const url = await getDownloadUrl(r2Key);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('Download URL error:', err);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
