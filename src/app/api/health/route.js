import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = { db: false, timestamp: new Date().toISOString() };
  try {
    const result = await db.select({ count: sql`count(*)` }).from(users);
    checks.db = true;
    checks.userCount = Number(result[0]?.count || 0);
  } catch (err) {
    checks.dbError = err.message;
  }
  checks.envVars = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
  };
  return NextResponse.json(checks);
}
