import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { sessions, users } from '@/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';

const SESSION_COOKIE = 'session_token';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  const insert = () =>
    db.insert(sessions).values({
      userId,
      token,
      expiresAt,
    });

  try {
    await insert();
  } catch (err) {
    console.error('[createSession] first attempt failed:', err.message);
    // Retry once (handles Neon cold start)
    await insert();
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE / 1000,
  });

  return token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const query = () =>
    db
      .select({
        sessionId: sessions.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        mustChangePassword: users.mustChangePassword,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);

  let result;
  try {
    result = await query();
  } catch (err) {
    console.error('[getSession] first attempt failed:', err.message);
    try {
      result = await query();
    } catch (retryErr) {
      console.error('[getSession] retry also failed:', retryErr.message);
      return null;
    }
  }

  return result[0] || null;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch (err) {
      console.error('[destroySession] DB delete failed:', err.message);
      // Continue to delete cookie even if DB delete fails
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== 'super_admin') {
    throw new Error('FORBIDDEN');
  }
  return session;
}

export async function safeRequireAuth() {
  const session = await getSession();
  if (!session) return { session: null, error: 'UNAUTHORIZED' };
  return { session, error: null };
}

export async function safeRequireAdmin() {
  const { session, error } = await safeRequireAuth();
  if (error) return { session: null, error };
  if (session.role !== 'super_admin') return { session: null, error: 'FORBIDDEN' };
  return { session, error: null };
}
