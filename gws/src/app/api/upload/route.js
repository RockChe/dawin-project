import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadToDrive } from '@/lib/drive';
import { createFileRecord } from '@/server/actions/tasks';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.scr', '.com'];

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

  // File size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '檔案過大，上限 50MB' }, { status: 413 });
  }

  // File extension check
  const ext = ('.' + (file.name || '').split('.').pop()).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: '不允許上傳此類型檔案' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Google Drive, get back a Drive file ID (stored as r2Key)
    const r2Key = await uploadToDrive(taskId, buffer, file.name, file.type);

    const result = await createFileRecord({
      taskId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      r2Key, // Actually a Google Drive file ID
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: '上傳失敗' },
      { status: 500 }
    );
  }
}
