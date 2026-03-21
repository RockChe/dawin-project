import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from '../src/server/db/schema.js';

async function updateAccounts() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required. Set it in .env file.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log('🔄 Updating accounts...\n');

  // 1. Update existing admin@example.com → rock0923@gmail.com
  const rockHash = await bcrypt.hash('750921', 12);
  const updated = await db.update(schema.users)
    .set({
      email: 'rock0923@gmail.com',
      name: 'Rock',
      passwordHash: rockHash,
      role: 'super_admin',
      mustChangePassword: false,
    })
    .where(eq(schema.users.email, 'admin@example.com'))
    .returning();

  if (updated.length > 0) {
    console.log('✅ Updated admin@example.com → rock0923@gmail.com (Rock)');
  } else {
    console.log('⚠️  admin@example.com not found, creating rock0923@gmail.com...');
    await db.insert(schema.users).values({
      email: 'rock0923@gmail.com',
      passwordHash: rockHash,
      role: 'super_admin',
      name: 'Rock',
      mustChangePassword: false,
    });
    console.log('✅ Created rock0923@gmail.com (Rock)');
  }

  // 2. Create 950201@gmail.com (姐姐)
  const jiejieHash = await bcrypt.hash('770214', 12);

  // Check if already exists
  const existing = await db.select()
    .from(schema.users)
    .where(eq(schema.users.email, '950201@gmail.com'));

  if (existing.length > 0) {
    await db.update(schema.users)
      .set({
        name: '姐姐',
        passwordHash: jiejieHash,
        role: 'super_admin',
        mustChangePassword: false,
      })
      .where(eq(schema.users.email, '950201@gmail.com'));
    console.log('✅ Updated 950201@gmail.com (姐姐)');
  } else {
    await db.insert(schema.users).values({
      email: '950201@gmail.com',
      passwordHash: jiejieHash,
      role: 'super_admin',
      name: '姐姐',
      mustChangePassword: false,
    });
    console.log('✅ Created 950201@gmail.com (姐姐)');
  }

  console.log('\n🎉 帳號更新完成！');
  console.log('\n📋 登入資訊：');
  console.log('   1. rock0923@gmail.com / 750921 (Rock, super_admin)');
  console.log('   2. 950201@gmail.com / 770214 (姐姐, super_admin)');
}

updateAccounts().catch(err => {
  console.error('❌ Update failed:', err);
  process.exit(1);
});
