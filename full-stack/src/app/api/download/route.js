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

  // Validate key format: must start with "tasks/" and not contain path traversal
  if (!r2Key.startsWith('tasks/') || r2Key.includes('..')) {
    return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
  }

  // Verify the file record exists in DB
  const fileRecord = await db.select().from(files).where(eq(files.r2Key, r2Key)).limit(1);
  if (!fileRecord[0]) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
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
