import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { users, projects, tasks, subtasks, links, files, configTable, auditLog, backupHistory } from '@/server/db/schema';
import { asc, desc } from 'drizzle-orm';

const BACKUP_VERSION = '1.0';
const BACKUP_PREFIX = 'backups/';

// ── Export all tables ──

export async function exportAllTables(db) {
  const [
    allUsers,
    allProjects,
    allTasks,
    allSubtasks,
    allLinks,
    allFiles,
    allConfig,
    allAuditLog,
    allBackupHistory,
  ] = await Promise.all([
    db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      name: users.name,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users),
    db.select().from(projects).orderBy(asc(projects.sortOrder)),
    db.select().from(tasks).orderBy(asc(tasks.sortOrder)),
    db.select().from(subtasks).orderBy(asc(subtasks.sortOrder)),
    db.select().from(links).orderBy(desc(links.createdAt)),
    db.select().from(files).orderBy(desc(files.createdAt)),
    db.select().from(configTable),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)),
    db.select().from(backupHistory).orderBy(desc(backupHistory.createdAt)),
  ]);

  return {
    meta: {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      tables: ['users', 'projects', 'tasks', 'subtasks', 'links', 'files', 'config', 'auditLog', 'backupHistory'],
      counts: {
        users: allUsers.length,
        projects: allProjects.length,
        tasks: allTasks.length,
        subtasks: allSubtasks.length,
        links: allLinks.length,
        files: allFiles.length,
        config: allConfig.length,
        auditLog: allAuditLog.length,
        backupHistory: allBackupHistory.length,
      },
    },
    data: {
      users: allUsers,
      projects: allProjects,
      tasks: allTasks,
      subtasks: allSubtasks,
      links: allLinks,
      files: allFiles,
      config: allConfig,
      auditLog: allAuditLog,
      backupHistory: allBackupHistory,
    },
  };
}

// ── Generate backup filename ──

export function generateBackupFileName() {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  return `dawin-backup-${ts}.json`;
}

// ── R2 (separate account) ──

function createBackupR2Client(credentials) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey,
    },
  });
}

export async function uploadToR2(backupData, credentials) {
  const client = createBackupR2Client(credentials);
  const fileName = generateBackupFileName();
  const content = JSON.stringify(backupData, null, 2);
  const key = `${BACKUP_PREFIX}${fileName}`;

  await client.send(new PutObjectCommand({
    Bucket: credentials.bucket,
    Key: key,
    Body: content,
    ContentType: 'application/json',
  }));

  return { fileName, key, fileSize: Buffer.byteLength(content, 'utf8') };
}

export async function listBackupsFromR2(credentials) {
  const client = createBackupR2Client(credentials);
  const response = await client.send(new ListObjectsV2Command({
    Bucket: credentials.bucket,
    Prefix: BACKUP_PREFIX,
    MaxKeys: 100,
  }));

  const items = (response.Contents || [])
    .filter(obj => obj.Key.endsWith('.json'))
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .map(obj => ({
      key: obj.Key,
      fileName: obj.Key.replace(BACKUP_PREFIX, ''),
      size: obj.Size,
      lastModified: obj.LastModified.toISOString(),
    }));

  return items;
}

export async function cleanupR2Backups(credentials, keepCount) {
  const items = await listBackupsFromR2(credentials);
  if (items.length <= keepCount) return 0;

  const client = createBackupR2Client(credentials);
  const toDelete = items.slice(keepCount);

  for (const item of toDelete) {
    await client.send(new DeleteObjectCommand({
      Bucket: credentials.bucket,
      Key: item.key,
    }));
  }

  return toDelete.length;
}

export async function testR2Connection(credentials) {
  const client = createBackupR2Client(credentials);
  await client.send(new ListObjectsV2Command({
    Bucket: credentials.bucket,
    Prefix: BACKUP_PREFIX,
    MaxKeys: 1,
  }));
  return true;
}

// ── Google Drive ──

async function getGoogleDriveClient(credentials) {
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT(
    credentials.email,
    null,
    credentials.privateKey.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive.file'],
  );
  return google.drive({ version: 'v3', auth });
}

export async function uploadToGoogleDrive(backupData, credentials) {
  const drive = await getGoogleDriveClient(credentials);
  const fileName = generateBackupFileName();
  const content = JSON.stringify(backupData, null, 2);
  const { Readable } = await import('stream');

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/json',
      parents: [credentials.folderId],
    },
    media: {
      mimeType: 'application/json',
      body: Readable.from([content]),
    },
    fields: 'id,name,size',
  });

  return {
    fileName,
    fileId: response.data.id,
    fileSize: Buffer.byteLength(content, 'utf8'),
  };
}

export async function listBackupsFromGDrive(credentials) {
  const drive = await getGoogleDriveClient(credentials);
  const response = await drive.files.list({
    q: `'${credentials.folderId}' in parents and mimeType='application/json' and name contains 'dawin-backup-' and trashed=false`,
    fields: 'files(id,name,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });

  return (response.data.files || []).map(f => ({
    fileId: f.id,
    fileName: f.name,
    size: Number(f.size || 0),
    lastModified: f.createdTime,
  }));
}

export async function cleanupGDriveBackups(credentials, keepCount) {
  const items = await listBackupsFromGDrive(credentials);
  if (items.length <= keepCount) return 0;

  const drive = await getGoogleDriveClient(credentials);
  const toDelete = items.slice(keepCount);

  for (const item of toDelete) {
    await drive.files.delete({ fileId: item.fileId });
  }

  return toDelete.length;
}

export async function testGDriveConnection(credentials) {
  const drive = await getGoogleDriveClient(credentials);
  await drive.files.list({
    q: `'${credentials.folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
  });
  return true;
}
