import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadToR2, deleteFromR2, getDownloadUrl } from '@/lib/r2';
import { db } from '@/server/db';
import { projects } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { isValidUUID } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const projectId = formData.get('projectId');

  if (!file || !projectId) {
    return NextResponse.json({ error: 'Missing file or projectId' }, { status: 400 });
  }

  if (!isValidUUID(projectId)) {
    return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
  }

  if (file.size > MAX_BANNER_SIZE) {
    return NextResponse.json({ error: `Banner 大小超過上限 (5MB)` }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: `不支援的檔案類型: ${file.type}` }, { status: 400 });
  }

  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: `不支援的副檔名: .${ext}` }, { status: 400 });
  }

  try {
    // Check project exists, ownership, and get old banner key
    const proj = await db.select({ id: projects.id, bannerR2Key: projects.bannerR2Key, createdBy: projects.createdBy })
      .from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!proj[0]) {
      return NextResponse.json({ error: '專案不存在' }, { status: 404 });
    }
    if (proj[0].createdBy !== session.userId && session.role !== 'super_admin') {
      return NextResponse.json({ error: '無權限修改此專案' }, { status: 403 });
    }

    const oldKey = proj[0].bannerR2Key;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = `projects/${projectId}/banner-${Date.now()}.${ext}`;

    await uploadToR2(key, buffer, file.type);

    // Update DB
    await db.update(projects).set({ bannerR2Key: key, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    // Delete old banner from R2
    if (oldKey) {
      try { await deleteFromR2(oldKey); } catch (err) {
        console.error('[upload-banner] old banner cleanup:', err);
      }
    }

    const bannerUrl = await getDownloadUrl(key);
    return NextResponse.json({ success: true, bannerUrl });
  } catch (err) {
    console.error('[upload-banner] error:', err);
    return NextResponse.json({ error: 'Banner 上傳失敗' }, { status: 500 });
  }
}
