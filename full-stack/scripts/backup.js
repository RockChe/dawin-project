import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { asc, desc } from 'drizzle-orm';
import * as schema from '../src/server/db/schema.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const BACKUP_VERSION = '1.0';
const BACKUP_PREFIX = 'backups/';

async function exportAllTables(db) {
  const [allUsers, allProjects, allTasks, allSubtasks, allLinks, allFiles, allConfig] = await Promise.all([
    db.select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      name: schema.users.name,
      mustChangePassword: schema.users.mustChangePassword,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users),
    db.select().from(schema.projects).orderBy(asc(schema.projects.sortOrder)),
    db.select().from(schema.tasks).orderBy(asc(schema.tasks.sortOrder)),
    db.select().from(schema.subtasks).orderBy(asc(schema.subtasks.sortOrder)),
    db.select().from(schema.links).orderBy(desc(schema.links.createdAt)),
    db.select().from(schema.files).orderBy(desc(schema.files.createdAt)),
    db.select().from(schema.configTable),
  ]);

  return {
    meta: {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      tables: ['users', 'projects', 'tasks', 'subtasks', 'links', 'files', 'config'],
      counts: {
        users: allUsers.length, projects: allProjects.length, tasks: allTasks.length,
        subtasks: allSubtasks.length, links: allLinks.length, files: allFiles.length, config: allConfig.length,
      },
    },
    data: { users: allUsers, projects: allProjects, tasks: allTasks, subtasks: allSubtasks, links: allLinks, files: allFiles, config: allConfig },
  };
}

function generateFileName() {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  return `dawin-backup-${ts}.json`;
}

async function backupToLocal(backupData) {
  const dir = 'backups';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fileName = generateFileName();
  const filePath = `${dir}/${fileName}`;
  const content = JSON.stringify(backupData, null, 2);
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  Local: ${filePath} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
}

async function backupToR2(backupData) {
  const { R2_BACKUP_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY, R2_BACKUP_SECRET_KEY, R2_BACKUP_BUCKET } = process.env;
  if (!R2_BACKUP_ACCOUNT_ID || !R2_BACKUP_ACCESS_KEY || !R2_BACKUP_SECRET_KEY || !R2_BACKUP_BUCKET) {
    throw new Error('Missing R2 backup env vars (R2_BACKUP_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY, R2_BACKUP_SECRET_KEY, R2_BACKUP_BUCKET)');
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_BACKUP_ACCESS_KEY, secretAccessKey: R2_BACKUP_SECRET_KEY },
  });
  const fileName = generateFileName();
  const content = JSON.stringify(backupData, null, 2);
  await client.send(new PutObjectCommand({
    Bucket: R2_BACKUP_BUCKET, Key: `${BACKUP_PREFIX}${fileName}`,
    Body: content, ContentType: 'application/json',
  }));
  console.log(`  R2: ${BACKUP_PREFIX}${fileName} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
}

async function backupToGDrive(backupData) {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_BACKUP_FOLDER_ID } = process.env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !GOOGLE_DRIVE_BACKUP_FOLDER_ID) {
    throw new Error('Missing Google Drive env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_BACKUP_FOLDER_ID)');
  }
  const { google } = await import('googleapis');
  const { Readable } = await import('stream');
  const auth = new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT_EMAIL, null,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive.file'],
  );
  const drive = google.drive({ version: 'v3', auth });
  const fileName = generateFileName();
  const content = JSON.stringify(backupData, null, 2);
  const response = await drive.files.create({
    requestBody: { name: fileName, mimeType: 'application/json', parents: [GOOGLE_DRIVE_BACKUP_FOLDER_ID] },
    media: { mimeType: 'application/json', body: Readable.from(content) },
    fields: 'id,name',
  });
  console.log(`  GDrive: ${response.data.name} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const toR2 = args.includes('--r2');
  const toGDrive = args.includes('--gdrive');
  const toLocal = !toR2 && !toGDrive; // Default: local

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Set it in .env file.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log('Exporting database...');
  const backupData = await exportAllTables(db);

  const { counts } = backupData.meta;
  console.log(`  Tables: ${Object.entries(counts).map(([k, v]) => `${k}(${v})`).join(', ')}`);

  console.log('Uploading...');
  if (toLocal) await backupToLocal(backupData);
  if (toR2) await backupToR2(backupData);
  if (toGDrive) await backupToGDrive(backupData);

  console.log('Backup complete!');
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
