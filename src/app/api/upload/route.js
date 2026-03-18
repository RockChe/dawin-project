import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2';
import { createFileRecord } from '@/server/actions/tasks';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const taskId = formData.get('taskId');

  if (!file || !taskId) {
    return NextResponse.json({ error: 'Missing file or taskId' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = `tasks/${taskId}/${Date.now()}-${file.name}`;

    await uploadToR2(key, buffer, file.type);

    const result = await createFileRecord({
      taskId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      r2Key: key,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: 'Upload failed', message: err.message },
      { status: 500 }
    );
  }
}
