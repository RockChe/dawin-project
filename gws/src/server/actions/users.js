'use server';

import { findUserByEmail, insertUser, updateUser, deleteUserById, getAllUsers } from '@/lib/sheets-dal';
import bcrypt from 'bcryptjs';
import { safeRequireAdmin } from '@/lib/auth';

export async function getUsers() {
  const { error } = await safeRequireAdmin();
  if (error) return { error };
  const users = await getAllUsers();
  // Exclude passwordHash from response
  return users.map(({ passwordHash, _rowIndex, ...rest }) => rest);
}

export async function createUser(formData) {
  const { error } = await safeRequireAdmin();
  if (error) return { error };

  const email = formData.get('email')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const password = formData.get('password')?.toString();
  const roleInput = formData.get('role')?.toString() || 'admin';
  const VALID_ROLES = ['admin', 'super_admin'];
  const role = VALID_ROLES.includes(roleInput) ? roleInput : 'admin';

  if (!email || !name || !password) {
    return { error: '請填寫所有欄位' };
  }

  if (password.length < 8) {
    return { error: '密碼至少需要 8 個字元' };
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return { error: '此 Email 已被使用' };
  }

  const hash = await bcrypt.hash(password, 12);
  await insertUser({
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

  try {
    const hash = await bcrypt.hash(newPassword, 12);
    await updateUser(userId, {
      passwordHash: hash,
      mustChangePassword: true,
    });
    return { success: true };
  } catch (err) {
    console.error('[resetUserPassword] error:', err);
    return { error: err.message || '重設密碼失敗' };
  }
}

export async function deleteUser(userId) {
  const { session, error } = await safeRequireAdmin();
  if (error) return { error };

  if (userId === session.userId) {
    return { error: '無法刪除自己的帳號' };
  }

  try {
    await deleteUserById(userId);
    return { success: true };
  } catch (err) {
    console.error('[deleteUser] error:', err);
    return { error: err.message || '刪除使用者失敗' };
  }
}
