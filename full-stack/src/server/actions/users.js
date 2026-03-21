'use server';

import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { safeRequireAdmin } from '@/lib/auth';

export async function getUsers() {
  const { error } = await safeRequireAdmin();
  if (error) return { error };
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);
  return result;
}

export async function createUser(formData) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  const email = formData.get('email')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const password = formData.get('password')?.toString();
  const role = formData.get('role')?.toString() || 'admin';

  if (!email || !name || !password) {
    return { error: '請填寫所有欄位' };
  }

  if (password.length < 8) {
    return { error: '密碼至少需要 8 個字元' };
  }

  // Check if email exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { error: '此 Email 已被使用' };
  }

  const hash = await bcrypt.hash(password, 12);

  await db.insert(users).values({
    email,
    name,
    passwordHash: hash,
    role,
    mustChangePassword: true,
  });

  return { success: true };
}

export async function resetUserPassword(userId, newPassword) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  if (!newPassword || newPassword.length < 8) {
    return { error: '密碼至少需要 8 個字元' };
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash: hash,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function deleteUser(userId) {
  const { session, error } = await safeRequireAdmin();
  if (error) return { error };

  // Prevent deleting yourself
  if (userId === session.userId) {
    return { error: '無法刪除自己的帳號' };
  }

  await db.delete(users).where(eq(users.id, userId));
  return { success: true };
}
