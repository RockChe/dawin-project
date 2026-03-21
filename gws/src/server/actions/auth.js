'use server';

import { findUserByEmail, updateUser } from '@/lib/sheets-dal';
import bcrypt from 'bcryptjs';
import { createSession, destroySession, getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const MAX_ATTEMPTS = 5;

function checkRateLimit(email) {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = loginAttempts.get(key);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    loginAttempts.set(key, { windowStart: now, count: 1 });
    return true;
  }
  record.count++;
  if (record.count > MAX_ATTEMPTS) return false;
  return true;
}

export async function login(prevState, formData) {
  const email = formData.get('email')?.toString().trim().toLowerCase();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: '請填寫所有欄位' };
  }

  if (!checkRateLimit(email)) {
    return { error: '登入嘗試次數過多，請稍後再試' };
  }

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (err) {
    console.error('[login] Sheets error:', err.message);
    return { error: '伺服器連線異常，請稍後再試' };
  }

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
    return { error: 'UNAUTHORIZED' };
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
    await updateUser(session.userId, {
      passwordHash: hash,
      mustChangePassword: false,
    });
  } catch (err) {
    console.error('[setPassword] error:', err.message);
    return { error: '設定密碼時發生錯誤，請稍後再試' };
  }

  return { success: true, redirectTo: '/' };
}
