'use server';

import { db } from '@/server/db';
import { users, tasks, subtasks, configTable as config } from '@/server/db/schema';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { replaceOwnerToken, replaceNameInList } from '@/lib/ownerNames';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';
import { withCap } from '@/lib/withCap';
import { ROLES } from '@/lib/permissions';

export async function getUsers() {
  return withCap('manage', async (session) => {
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
    // currentUserId 讓前端知道「哪一列是自己」，藉此 disable 自己那列的角色下拉
    return { users: result, currentUserId: session.userId };
  });
}

export async function createUser(formData) {
  return withCap('manage', async () => {
    const email = formData.get('email')?.toString().trim().toLowerCase();
    const name = formData.get('name')?.toString().trim();
    const password = formData.get('password')?.toString();
    const role = formData.get('role')?.toString();

    // Validate role enum：漏傳 role 應該是錯誤，不是靜默給出寫入權限
    if (!role || !ROLES.includes(role)) {
      return { error: `無效的角色: ${role ?? '(未指定)'}` };
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
  });
}

import { isValidUUID } from '@/lib/utils';

export async function resetUserPassword(userId, newPassword) {
  return withCap('manage', async (session) => {
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
  });
}

// 保留最後一個 super_admin 的不變量：neon-http 這條 driver 不支援互動式 transaction
// （db.transaction() 直接 throw「No transactions support」），所以「先數還剩幾個、
// 再決定要不要放行」不能拆成兩支查詢——兩個 super_admin 同時互降，兩邊各自查到
// 「還有 2 個」就都放行，系統會歸零。
// 這裡改用「WITH ... FOR UPDATE + UPDATE/DELETE ... RETURNING」包成單一 SQL 陳述式：
// FOR UPDATE 鎖住全部 super_admin 列，逼第二個請求排隊等第一個 commit 後才重新讀到
// 更新後的計數，藉此在單一 statement 內做到跟 transaction 一樣的原子性。
// 兩支語句共用同一段守護條件的文字，寫成 raw string 而非 sql fragment ——
// drizzle 的 sql`` 樣板會把巢狀的 sql fragment 攤平成 query 的一部分，
// 這裡故意用純字串內插（沒有使用者輸入、無 injection 疑慮）以維持兩支語句的
// 參數順序單純好懂（UPDATE：[role, userId]；DELETE：[userId]）。
const SUPER_ADMIN_LOCK_CTE = `WITH sa_lock AS (SELECT id FROM users WHERE role = 'super_admin' FOR UPDATE)`;
const SUPER_ADMIN_GUARD = `(role <> 'super_admin' OR (SELECT count(*) FROM sa_lock) > 1)`;

export async function updateUser(userId, data) {
  return withCap('manage', async (session) => {
    if (!isValidUUID(userId)) return { error: 'Invalid user ID' };

    const hasName = data?.name !== undefined;
    const hasRole = data?.role !== undefined;
    if (!hasName && !hasRole) return { error: '沒有可更新的欄位' };

    let name;
    if (hasName) {
      name = data.name?.trim();
      if (!name || name.length === 0) return { error: '姓名不可為空' };
      if (name.length > 255) return { error: '姓名不可超過 255 字元' };
    }

    if (hasRole) {
      if (!ROLES.includes(data.role)) return { error: `無效的角色: ${data.role}` };
      // 不可把自己降級：一旦畫面群組把自己擋在外面，就再也進不來改回去了
      if (userId === session.userId && data.role !== session.role) {
        return { error: '不能變更自己的角色' };
      }
    }

    if (hasName) {
      const [prev] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      if (!prev) return { error: '使用者不存在' };

      // 改名連動：tasks.owner 與 config 'owners' 存的是名字字串（不是 FK），不同步就會變孤兒。
      // neon-http 沒有互動式 transaction → 全部 UPDATE 收進同一個 db.batch（單次往返、全成功或全回滾）。
      // 每筆 UPDATE 都帶「值仍等於剛讀到的舊值」守衛，避免蓋掉讀寫之間別人剛改的內容。
      const stmts = [db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId))];
      if (prev.name !== name) {
        // ponytail: 撈全部有 owner 的任務在 JS 比對（資料量為單一團隊規模）；變大再改 SQL 層過濾。
        // subtasks.owner（varchar 255）同樣要換，否則下次編輯子任務會用舊名重新推得父任務 owner。
        // 新名比舊名長時可能超過欄位上限 → 先檢查，超過就整個改名拒絕（不寫半套）。
        for (const [table, limit] of [[tasks, 500], [subtasks, 255]]) {
          const owned = await db.select({ id: table.id, owner: table.owner }).from(table).where(isNotNull(table.owner));
          for (const t of owned) {
            const next = replaceOwnerToken(t.owner, prev.name, name);
            if (next === t.owner) continue;
            if (next.length > limit) return { error: `改名後負責人欄位超過 ${limit} 字元上限，請先縮短該筆資料` };
            stmts.push(db.update(table).set({ owner: next }).where(and(eq(table.id, t.id), eq(table.owner, t.owner))));
          }
        }
        const [cfg] = await db.select({ value: config.value }).from(config).where(eq(config.key, 'owners')).limit(1);
        let list;
        try { list = JSON.parse(cfg?.value); } catch { /* 非 JSON → 略過 */ }
        if (Array.isArray(list)) {
          stmts.push(db.update(config).set({ value: JSON.stringify(replaceNameInList(list, prev.name, name)), updatedAt: new Date() })
            .where(and(eq(config.key, 'owners'), eq(config.value, cfg.value))));
        }
      }
      await db.batch(stmts);
    }

    if (hasRole) {
      const result = await db.execute(sql`
        ${sql.raw(SUPER_ADMIN_LOCK_CTE)}
        UPDATE users
        SET role = ${data.role}, updated_at = now()
        WHERE id = ${userId} AND ${sql.raw(SUPER_ADMIN_GUARD)}
        RETURNING id, role
      `);
      const rows = result.rows ?? result;
      if (rows.length === 0) return { error: '系統必須至少保留一個 Super Admin' };
    }

    await logAudit('USER_UPDATE', session.userId, {
      resourceType: 'user',
      resourceId: userId,
      detail: [hasName && `name → ${name}`, hasRole && `role → ${data.role}`].filter(Boolean).join('; '),
    });

    return { success: true };
  });
}

export async function deleteUser(userId) {
  return withCap('manage', async (session) => {
    if (!isValidUUID(userId)) return { error: 'Invalid user ID' };

    // Prevent deleting yourself
    if (userId === session.userId) {
      return { error: '無法刪除自己的帳號' };
    }

    const result = await db.execute(sql`
      ${sql.raw(SUPER_ADMIN_LOCK_CTE)}
      DELETE FROM users
      WHERE id = ${userId} AND ${sql.raw(SUPER_ADMIN_GUARD)}
      RETURNING id, email
    `);
    const rows = result.rows ?? result;
    if (rows.length === 0) return { error: '系統必須至少保留一個 Super Admin' };

    await logAudit('USER_DELETE', session.userId, {
      resourceType: 'user',
      resourceId: userId,
      detail: rows[0]?.email,
    });

    return { success: true };
  });
}
