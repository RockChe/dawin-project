import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cronBackup } from '@/server/actions/backup';
import { exportAllTables } from '@/lib/backup';
import { db } from '@/server/db';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for backup

// POST — Vercel Cron trigger
export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  // Timing-safe comparison to prevent timing attacks
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (authBuf.length !== expectedBuf.length || !timingSafeEqual(authBuf, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await cronBackup();
  return NextResponse.json(result);
}

// GET — Manual download (super_admin)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backupData = await exportAllTables(db);
  const content = JSON.stringify(backupData, null, 2);
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  const fileName = `dawin-backup-${ts}.json`;

  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
