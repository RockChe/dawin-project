import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from '../src/server/db/schema.js';

async function cleanup() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  // Get Rock's user ID
  const [rock] = await db.select().from(schema.users).where(eq(schema.users.email, 'rock0923@gmail.com'));
  if (!rock) {
    console.error('❌ rock0923@gmail.com not found');
    process.exit(1);
  }
  console.log(`Rock ID: ${rock.id}`);

  // Get old admin
  const oldAdmins = await db.select().from(schema.users)
    .where(eq(schema.users.email, 'admin@jiejie.com'));

  for (const old of oldAdmins) {
    console.log(`\nMigrating references from ${old.email} (${old.id}) → Rock (${rock.id})`);

    // Update projects.createdBy
    await db.update(schema.projects).set({ createdBy: rock.id }).where(eq(schema.projects.createdBy, old.id));
    console.log('  ✅ projects.createdBy updated');

    // Update tasks.createdBy
    await db.update(schema.tasks).set({ createdBy: rock.id }).where(eq(schema.tasks.createdBy, old.id));
    console.log('  ✅ tasks.createdBy updated');

    // Update links.createdBy
    await db.update(schema.links).set({ createdBy: rock.id }).where(eq(schema.links.createdBy, old.id));
    console.log('  ✅ links.createdBy updated');

    // Update files.createdBy
    await db.update(schema.files).set({ createdBy: rock.id }).where(eq(schema.files.createdBy, old.id));
    console.log('  ✅ files.createdBy updated');

    // Delete old sessions
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, old.id));
    console.log('  ✅ sessions deleted');

    // Now delete the old user
    await db.delete(schema.users).where(eq(schema.users.id, old.id));
    console.log(`  🗑️  Deleted ${old.email}`);
  }

  // Verify
  const remaining = await db.select({ email: schema.users.email, name: schema.users.name, role: schema.users.role }).from(schema.users);
  console.log('\n✅ Final users:', remaining);
}

cleanup().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
