import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/server/db/schema.js';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { sql as rawSql } from 'drizzle-orm';

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');

  if (!filePath) {
    console.log('Usage: node scripts/restore.js <backup-file.json> [--dry-run] [--confirm]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run   Parse and validate without writing to DB');
    console.log('  --confirm   Required for actual restore (destructive operation)');
    process.exit(0);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Set it in .env file.');
    process.exit(1);
  }

  // Read backup file
  console.log(`Reading backup: ${filePath}`);
  const raw = readFileSync(filePath, 'utf-8');
  const backup = JSON.parse(raw);

  if (!backup.meta || !backup.data) {
    console.error('Invalid backup format: missing meta or data');
    process.exit(1);
  }

  console.log(`  Version: ${backup.meta.version}`);
  console.log(`  Created: ${backup.meta.createdAt}`);
  console.log(`  Counts: ${Object.entries(backup.meta.counts).map(([k, v]) => `${k}(${v})`).join(', ')}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Validation passed. No changes made.');
    process.exit(0);
  }

  if (!confirm) {
    console.error('\nThis will DELETE all existing data and replace with backup.');
    console.error('Add --confirm flag to proceed.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log('\nRestoring database...');

  // Delete in reverse FK order
  console.log('  Clearing existing data...');
  await db.delete(schema.links);
  await db.delete(schema.files);
  await db.delete(schema.subtasks);
  await db.delete(schema.tasks);
  await db.delete(schema.projects);
  await db.delete(schema.configTable);
  await db.delete(schema.sessions);
  await db.delete(schema.users);

  // Restore users (with temp password)
  const tempPasswords = [];
  if (backup.data.users?.length > 0) {
    for (const u of backup.data.users) {
      const tempPw = randomBytes(6).toString('hex');
      const hash = await bcrypt.hash(tempPw, 12);
      await db.insert(schema.users).values({
        id: u.id,
        email: u.email,
        passwordHash: hash,
        role: u.role,
        name: u.name,
        mustChangePassword: true,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      });
      tempPasswords.push({ email: u.email, name: u.name, password: tempPw });
    }
    console.log(`  Users: ${backup.data.users.length} restored`);
  }

  // Restore projects
  if (backup.data.projects?.length > 0) {
    for (const p of backup.data.projects) {
      await db.insert(schema.projects).values({
        id: p.id,
        name: p.name,
        sortOrder: p.sortOrder ?? 0,
        createdBy: p.createdBy,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      });
    }
    console.log(`  Projects: ${backup.data.projects.length} restored`);
  }

  // Restore tasks
  if (backup.data.tasks?.length > 0) {
    for (const t of backup.data.tasks) {
      await db.insert(schema.tasks).values({
        id: t.id,
        projectId: t.projectId,
        task: t.task,
        status: t.status,
        category: t.category,
        startDate: t.startDate,
        endDate: t.endDate,
        duration: t.duration,
        owner: t.owner,
        priority: t.priority,
        notes: t.notes,
        sortOrder: t.sortOrder ?? 0,
        createdBy: t.createdBy,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
      });
    }
    console.log(`  Tasks: ${backup.data.tasks.length} restored`);
  }

  // Restore subtasks
  if (backup.data.subtasks?.length > 0) {
    for (const s of backup.data.subtasks) {
      await db.insert(schema.subtasks).values({
        id: s.id,
        taskId: s.taskId,
        name: s.name,
        owner: s.owner,
        done: s.done ?? false,
        doneDate: s.doneDate,
        notes: s.notes,
        sortOrder: s.sortOrder ?? 0,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      });
    }
    console.log(`  Subtasks: ${backup.data.subtasks.length} restored`);
  }

  // Restore links
  if (backup.data.links?.length > 0) {
    for (const l of backup.data.links) {
      await db.insert(schema.links).values({
        id: l.id,
        taskId: l.taskId,
        url: l.url,
        title: l.title,
        createdBy: l.createdBy,
        createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
      });
    }
    console.log(`  Links: ${backup.data.links.length} restored`);
  }

  // Restore files (metadata only)
  if (backup.data.files?.length > 0) {
    for (const f of backup.data.files) {
      await db.insert(schema.files).values({
        id: f.id,
        taskId: f.taskId,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        r2Key: f.r2Key,
        createdBy: f.createdBy,
        createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
      });
    }
    console.log(`  Files: ${backup.data.files.length} restored (metadata only)`);
  }

  // Restore config
  if (backup.data.config?.length > 0) {
    for (const c of backup.data.config) {
      await db.insert(schema.configTable).values({
        id: c.id,
        key: c.key,
        value: c.value,
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      });
    }
    console.log(`  Config: ${backup.data.config.length} restored`);
  }

  console.log('\nRestore complete!');

  if (tempPasswords.length > 0) {
    console.log('\nTemporary passwords (users must change on first login):');
    for (const u of tempPasswords) {
      console.log(`  ${u.email} (${u.name}): ${u.password}`);
    }
  }
}

main().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
