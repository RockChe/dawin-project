import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = { status: 'ok', timestamp: new Date().toISOString() };
  try {
    await db.select({ count: sql`count(*)` }).from(users);
    checks.db = true;
  } catch {
    checks.status = 'degraded';
    checks.db = false;
  }
  checks.cronSecret = Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32);
  if (!checks.cronSecret) checks.status = 'degraded';
  return NextResponse.json(checks);
}
