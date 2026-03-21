import { cookies } from 'next/headers';
import { insertSession, findSessionByToken, deleteSessionByToken, deleteSessionsByUserId, findUserById } from '@/lib/sheets-dal';

const SESSION_COOKIE = 'session_token';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId) {
  // Clean up old sessions for this user
  try { await deleteSessionsByUserId(userId); } catch (e) { console.error('[createSession] cleanup error:', e); }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();

  await insertSession({
    userId,
    token,
    expiresAt,
  });

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

  try {
    const session = await findSessionByToken(token);
    if (!session) return null;

    // Check expiry
    if (new Date(session.expiresAt) <= new Date()) return null;

    const user = await findUserById(session.userId);
    if (!user) return null;

    return {
      sessionId: session.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  } catch (err) {
    console.error('[getSession] error:', err.message);
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await deleteSessionByToken(token);
    } catch (err) {
      console.error('[destroySession] delete failed:', err.message);
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
