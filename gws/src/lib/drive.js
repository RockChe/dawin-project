import { getDriveClient } from './google';
import { Readable } from 'stream';

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

async function findOrCreateFolder(drive, parentId, folderName) {
  // Check if folder exists
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return folder.data.id;
}

/**
 * Upload a file to Google Drive under {ROOT}/tasks/{taskId}/
 * @returns {string} driveFileId (stored as r2Key in the files table)
 */
export async function uploadToDrive(taskId, buffer, fileName, mimeType) {
  const drive = getDriveClient();

  // Ensure folder structure: ROOT/tasks/{taskId}/
  const tasksFolderId = await findOrCreateFolder(drive, ROOT_FOLDER_ID, 'tasks');
  const taskFolderId = await findOrCreateFolder(drive, tasksFolderId, taskId);

  // Upload file
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [taskFolderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from(buffer),
    },
    fields: 'id',
  });

  return res.data.id; // This is stored as r2Key
}

/**
 * Get a download stream for a Drive file.
 * Returns { stream, mimeType, name } for the API route to proxy.
 * @param {string} r2Key - Actually a Google Drive file ID
 */
export async function getDriveFile(r2Key) {
  const drive = getDriveClient();

  // Get file metadata
  const meta = await drive.files.get({
    fileId: r2Key,
    fields: 'name,mimeType',
  });

  // Get file content as stream
  const res = await drive.files.get({
    fileId: r2Key,
    alt: 'media',
  }, { responseType: 'stream' });

  return {
    stream: res.data,
    mimeType: meta.data.mimeType,
    name: meta.data.name,
  };
}

/**
 * Delete a file from Google Drive.
 * @param {string} r2Key - Actually a Google Drive file ID
 */
export async function deleteFromDrive(r2Key) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId: r2Key });
}
