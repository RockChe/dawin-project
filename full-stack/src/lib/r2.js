import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadToR2(key, body, contentType) {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return key;
}

export async function getDownloadUrl(key) {
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  const client = getR2Client();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }), { expiresIn: 900 });
}

export async function deleteFromR2(key) {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }));
}
