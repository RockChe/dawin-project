'use server';

import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { safeRequireAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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

  // Validate role enum
  const VALID_ROLES = ['super_admin', 'admin'];
  if (!VALID_ROLES.includes(role)) {
    return { error: `無效的角色: ${role}` };
  }

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

import { isValidUUID } from '@/lib/utils';

export async function resetUserPassword(userId, newPassword) {
  const { session, error } = await safeRequireAdmin();
  if (error) return { error };

  if (!isValidUUID(userId)) return { error: 'Invalid user ID' };

  if (!newPassword || newPassword.length < 8) {
    return { error: '密碼至少需要 8 個字元' };
  }

  // Verify user exists before updating
  const target = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target[0]) return { error: '使用者不存在' };

  const hash = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash: hash,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await logAudit('PASSWORD_RESET', session.userId, {
    resourceType: 'user',
    resourceId: userId,
  });

  return { success: true };
}

export async function updateUser(userId, data) {
  const { session, error } = await safeRequireAdmin();
  if (error) return { error };

  if (!isValidUUID(userId)) return { error: 'Invalid user ID' };

  const name = data?.name?.trim();
  if (!name || name.length === 0) return { error: '姓名不可為空' };
  if (name.length > 255) return { error: '姓名不可超過 255 字元' };

  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));

  await logAudit('USER_UPDATE', session.userId, {
    resourceType: 'user',
    resourceId: userId,
    detail: `name → ${name}`,
  });

  return { success: true };
}

export async function deleteUser(userId) {
  const { session, error } = await safeRequireAdmin();
  if (error) return { error };

  if (!isValidUUID(userId)) return { error: 'Invalid user ID' };

  // Prevent deleting yourself
  if (userId === session.userId) {
    return { error: '無法刪除自己的帳號' };
  }

  // 先取得被刪除使用者的 email 供 audit log 記錄
  const target = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);

  await db.delete(users).where(eq(users.id, userId));

  await logAudit('USER_DELETE', session.userId, {
    resourceType: 'user',
    resourceId: userId,
    detail: target[0]?.email,
  });

  return { success: true };
}
