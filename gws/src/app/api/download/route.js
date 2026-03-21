import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDriveFile } from '@/lib/drive';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const r2Key = searchParams.get('key'); // Actually a Google Drive file ID

  if (!r2Key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const { stream, mimeType, name } = await getDriveFile(r2Key);

    // Collect stream chunks into a buffer for Next.js Response
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('Download error:', err);
    return NextResponse.json(
      { error: '下載失敗' },
      { status: 500 }
    );
  }
}
