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
      await tx.delete(schema.auditLog);
      await tx.delete(schema.backupHistory);
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

      // Build FK validation sets
      const validUserIds = new Set(userRows.map(u => u.id));
      const validProjectIds = new Set();
      const validTaskIds = new Set();

      // Restore projects (validate createdBy FK)
      if (backup.data.projects?.length > 0) {
        let skipped = 0;
        for (const p of backup.data.projects) {
          const createdBy = p.createdBy && validUserIds.has(p.createdBy) ? p.createdBy : null;
          if (p.createdBy && !validUserIds.has(p.createdBy)) {
            console.warn(`  [WARN] Project "${p.name}": createdBy ${p.createdBy} not found, set to null`);
          }
          await tx.insert(schema.projects).values({
            id: p.id,
            name: p.name,
            sortOrder: p.sortOrder ?? 0,
            createdBy,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          });
          validProjectIds.add(p.id);
        }
        console.log(`  Projects: ${backup.data.projects.length} restored`);
      }

      // Restore tasks (validate projectId + createdBy FK)
      if (backup.data.tasks?.length > 0) {
        let skipped = 0;
        for (const t of backup.data.tasks) {
          if (!validProjectIds.has(t.projectId)) {
            console.warn(`  [WARN] Task "${t.task}": projectId ${t.projectId} not found, skipped`);
            skipped++;
            continue;
          }
          const createdBy = t.createdBy && validUserIds.has(t.createdBy) ? t.createdBy : null;
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
            createdBy,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          });
          validTaskIds.add(t.id);
        }
        console.log(`  Tasks: ${backup.data.tasks.length - skipped} restored${skipped ? ` (${skipped} skipped)` : ''}`);
      }

      // Restore subtasks (validate taskId FK)
      if (backup.data.subtasks?.length > 0) {
        let skipped = 0;
        for (const s of backup.data.subtasks) {
          if (!validTaskIds.has(s.taskId)) {
            console.warn(`  [WARN] Subtask "${s.name}": taskId ${s.taskId} not found, skipped`);
            skipped++;
            continue;
          }
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
        console.log(`  Subtasks: ${backup.data.subtasks.length - skipped} restored${skipped ? ` (${skipped} skipped)` : ''}`);
      }

      // Restore links (validate taskId + createdBy FK)
      if (backup.data.links?.length > 0) {
        let skipped = 0;
        for (const l of backup.data.links) {
          if (!validTaskIds.has(l.taskId)) {
            console.warn(`  [WARN] Link "${l.url}": taskId ${l.taskId} not found, skipped`);
            skipped++;
            continue;
          }
          const createdBy = l.createdBy && validUserIds.has(l.createdBy) ? l.createdBy : null;
          await tx.insert(schema.links).values({
            id: l.id,
            taskId: l.taskId,
            url: l.url,
            title: l.title,
            createdBy,
            createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
          });
        }
        console.log(`  Links: ${backup.data.links.length - skipped} restored${skipped ? ` (${skipped} skipped)` : ''}`);
      }

      // Restore files (validate taskId + createdBy FK, metadata only)
      if (backup.data.files?.length > 0) {
        let skipped = 0;
        for (const f of backup.data.files) {
          if (!validTaskIds.has(f.taskId)) {
            console.warn(`  [WARN] File "${f.name}": taskId ${f.taskId} not found, skipped`);
            skipped++;
            continue;
          }
          const createdBy = f.createdBy && validUserIds.has(f.createdBy) ? f.createdBy : null;
          await tx.insert(schema.files).values({
            id: f.id,
            taskId: f.taskId,
            name: f.name,
            size: f.size,
            mimeType: f.mimeType,
            r2Key: f.r2Key,
            createdBy,
            createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
          });
        }
        console.log(`  Files: ${backup.data.files.length - skipped} restored (metadata only)${skipped ? ` (${skipped} skipped)` : ''}`);
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

      // Restore audit log (backward compatible — skip if not in backup, validate userId FK)
      if (backup.data.auditLog?.length > 0) {
        for (const a of backup.data.auditLog) {
          const userId = a.userId && validUserIds.has(a.userId) ? a.userId : null;
          await tx.insert(schema.auditLog).values({
            id: a.id,
            action: a.action,
            userId,
            resourceType: a.resourceType,
            resourceId: a.resourceId,
            detail: a.detail,
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
          });
        }
        console.log(`  Audit Log: ${backup.data.auditLog.length} restored`);
      }

      // Restore backup history (backward compatible)
      if (backup.data.backupHistory?.length > 0) {
        for (const b of backup.data.backupHistory) {
          await tx.insert(schema.backupHistory).values({
            id: b.id,
            target: b.target,
            fileName: b.fileName,
            fileSize: b.fileSize,
            status: b.status,
            error: b.error,
            durationMs: b.durationMs,
            tableCounts: b.tableCounts,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
          });
        }
        console.log(`  Backup History: ${backup.data.backupHistory.length} restored`);
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
