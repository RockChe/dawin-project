'use server';

import { db } from '@/server/db';
import { users, sessions } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createSession, destroySession, getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function login(formData) {
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: '請填寫所有欄位' };
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = result[0];
  if (!user) {
    return { error: '帳號或密碼錯誤' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: '帳號或密碼錯誤' };
  }

  await createSession(user.id);

  if (user.mustChangePassword) {
    redirect('/set-password');
  }

  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

export async function setPassword(formData) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const newPassword = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirmPassword')?.toString();

  if (!newPassword || newPassword.length < 8) {
    return { error: '密碼至少需要 8 個字元' };
  }

  if (newPassword !== confirmPassword) {
    return { error: '兩次密碼輸入不一致' };
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash: hash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.userId));

  redirect('/');
}
