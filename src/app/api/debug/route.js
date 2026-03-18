import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { sessions, users, projects, tasks } from '@/server/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = { timestamp: new Date().toISOString(), checks: {} };

  // 1. Check cookie
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    result.checks.hasCookie = !!token;
    result.checks.tokenPrefix = token ? token.substring(0, 8) + '...' : null;
  } catch (e) {
    result.checks.cookieError = e.message;
  }

  // 2. Check DB connectivity
  try {
    const r = await db.select({ count: sql`count(*)` }).from(users);
    result.checks.db = true;
    result.checks.userCount = Number(r[0]?.count || 0);
  } catch (e) {
    result.checks.db = false;
    result.checks.dbError = e.message;
  }

  // 3. Check session validity (if cookie present)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (token) {
      const sess = await db
        .select({
          sessionId: sessions.id,
          userId: users.id,
          email: users.email,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.token, token))
        .limit(1);

      if (sess[0]) {
        result.checks.session = {
          found: true,
          userId: sess[0].userId,
          email: sess[0].email,
          expiresAt: sess[0].expiresAt,
          isExpired: new Date(sess[0].expiresAt) < new Date(),
        };
      } else {
        result.checks.session = { found: false, reason: 'token not in DB' };
      }
    }
  } catch (e) {
    result.checks.sessionError = e.message;
  }

  // 4. Check data counts
  try {
    const [pc, tc] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(projects),
      db.select({ count: sql`count(*)` }).from(tasks),
    ]);
    result.checks.projectCount = Number(pc[0]?.count || 0);
    result.checks.taskCount = Number(tc[0]?.count || 0);
  } catch (e) {
    result.checks.dataCountError = e.message;
  }

  return NextResponse.json(result);
}
