import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/r2';

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

  try {
    const url = await getDownloadUrl(r2Key);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('Download URL error:', err);
    return NextResponse.json(
      { error: 'Failed to generate download URL', message: err.message },
      { status: 500 }
    );
  }
}
