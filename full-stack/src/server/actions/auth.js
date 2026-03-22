'use server';

import { db } from '@/server/db';
import { users, sessions } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createSession, destroySession, getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function login(prevState, formData) {
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: '請填寫所有欄位' };
  }

  let result;
  try {
    result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  } catch (err) {
    console.error('[login] DB error:', err.message);
    return { error: '伺服器連線異常，請稍後再試' };
  }

  const user = result[0];
  if (!user) {
    return { error: '帳號或密碼錯誤' };
  }

  let valid;
  try {
    valid = await bcrypt.compare(password, user.passwordHash);
  } catch (err) {
    console.error('[login] bcrypt error:', err.message);
    return { error: '伺服器錯誤，請稍後再試' };
  }

  if (!valid) {
    // Basic brute-force mitigation: delay on failed attempts
    await new Promise(r => setTimeout(r, 1000));
    return { error: '帳號或密碼錯誤' };
  }

  try {
    await createSession(user.id);
  } catch (err) {
    console.error('[login] createSession error:', err.message);
    return { error: '登入過程發生錯誤，請稍後再試' };
  }

  if (user.mustChangePassword) {
    return { success: true, redirectTo: '/set-password' };
  }

  return { success: true, redirectTo: '/' };
}

export async function logout() {
  try {
    await destroySession();
  } catch (err) {
    console.error('[logout] destroySession error:', err.message);
  }
  redirect('/login');
}

export async function getSessionInfo() {
  const session = await getSession();
  if (!session) return { error: 'UNAUTHORIZED' };
  return { role: session.role, name: session.name, email: session.email };
}

export async function setPassword(prevState, formData) {
  const session = await getSession();
  if (!session) {
    return { success: true, redirectTo: '/login' };
  }

  const newPassword = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirmPassword')?.toString();

  if (!newPassword || newPassword.length < 8) {
    return { error: '密碼至少需要 8 個字元' };
  }

  if (newPassword !== confirmPassword) {
    return { error: '兩次密碼輸入不一致' };
  }

  try {
    const hash = await bcrypt.hash(newPassword, 12);

    await db
      .update(users)
      .set({
        passwordHash: hash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));
  } catch (err) {
    console.error('[setPassword] error:', err.message);
    return { error: '設定密碼時發生錯誤，請稍後再試' };
  }

  return { success: true, redirectTo: '/' };
}
