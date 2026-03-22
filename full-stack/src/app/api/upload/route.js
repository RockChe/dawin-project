import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadToR2, deleteFromR2 } from '@/lib/r2';
import { createFileRecord } from '@/server/actions/tasks';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_MIME_PREFIXES = [
  'image/', 'video/', 'audio/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats',
  'application/vnd.ms-',
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-rar',
  'application/json',
];

function isAllowedMime(mimeType) {
  if (!mimeType) return false;
  return ALLOWED_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix));
}

function sanitizeFilename(name) {
  // Remove path traversal characters and control chars
  return name
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
}

// Validate UUID format
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

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

  // Validate taskId format
  if (!isValidUUID(taskId)) {
    return NextResponse.json({ error: 'Invalid taskId format' }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `檔案大小超過上限 (${MAX_FILE_SIZE / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  // Validate MIME type
  if (!isAllowedMime(file.type)) {
    return NextResponse.json(
      { error: `不支援的檔案類型: ${file.type}` },
      { status: 400 }
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = sanitizeFilename(file.name);
    const key = `tasks/${taskId}/${Date.now()}-${safeName}`;

    await uploadToR2(key, buffer, file.type);

    const result = await createFileRecord({
      taskId,
      name: safeName,
      size: file.size,
      mimeType: file.type,
      r2Key: key,
    });

    if (result.error) {
      // DB record creation failed — clean up R2 orphan
      try { await deleteFromR2(key); } catch (cleanupErr) {
        console.error('[upload] R2 cleanup after DB failure:', cleanupErr);
      }
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
