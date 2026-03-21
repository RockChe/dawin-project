import { google } from 'googleapis';

let _auth;

function getAuth() {
  if (!_auth) {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    _auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });
  }
  return _auth;
}

let _sheets;
export function getSheetsClient() {
  if (!_sheets) {
    _sheets = google.sheets({ version: 'v4', auth: getAuth() });
  }
  return _sheets;
}

let _drive;
export function getDriveClient() {
  if (!_drive) {
    _drive = google.drive({ version: 'v3', auth: getAuth() });
  }
  return _drive;
}
