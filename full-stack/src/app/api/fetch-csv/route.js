import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: { 'Accept': 'text/csv,text/plain,*/*' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    return NextResponse.json({ csv: text });
  } catch (err) {
    console.error('Fetch CSV error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch CSV', message: err.message },
      { status: 500 }
    );
  }
}
