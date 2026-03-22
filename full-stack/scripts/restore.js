import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../src/server/db/schema.js';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

// WebSocket is required for Neon Pool (transaction support)
neonConfig.webSocketConstructor = ws;

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

  // Pre-compute password hashes outside transaction (bcrypt is slow)
  console.log('\nPre-computing password hashes...');
  const tempPasswords = [];
  const userRows = [];
  if (backup.data.users?.length > 0) {
    for (const u of backup.data.users) {
      const tempPw = randomBytes(16).toString('hex');
      const hash = await bcrypt.hash(tempPw, 12);
      tempPasswords.push({ email: u.email, name: u.name, password: tempPw });
      userRows.push({
        id: u.id,
        email: u.email,
        passwordHash: hash,
        role: u.role,
        name: u.name,
        mustChangePassword: true,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      });
    }
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('Restoring database (inside transaction)...');

  try {
    await db.transaction(async (tx) => {
      // Delete in reverse FK order
      console.log('  Clearing existing data...');
      await tx.delete(schema.links);
      await tx.delete(schema.files);
      await tx.delete(schema.subtasks);
      await tx.delete(schema.tasks);
      await tx.delete(schema.projects);
      await tx.delete(schema.configTable);
      await tx.delete(schema.sessions);
      await tx.delete(schema.users);

      // Restore users
      if (userRows.length > 0) {
        for (const row of userRows) {
          await tx.insert(schema.users).values(row);
        }
        console.log(`  Users: ${userRows.length} restored`);
      }

      // Restore projects
      if (backup.data.projects?.length > 0) {
        for (const p of backup.data.projects) {
          await tx.insert(schema.projects).values({
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
          await tx.insert(schema.tasks).values({
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
          await tx.insert(schema.subtasks).values({
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
          await tx.insert(schema.links).values({
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
          await tx.insert(schema.files).values({
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
          await tx.insert(schema.configTable).values({
            id: c.id,
            key: c.key,
            value: c.value,
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
          });
        }
        console.log(`  Config: ${backup.data.config.length} restored`);
      }
    });

    console.log('\nRestore complete! (transaction committed)');
  } catch (err) {
    console.error('\nRestore FAILED — transaction rolled back, no data was changed.');
    throw err;
  } finally {
    await pool.end();
  }

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
