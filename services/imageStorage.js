const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const localUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'designs');

function safeExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ext || '.jpg';
}

function buildKey(file) {
  return `designs/${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension(file.originalname)}`;
}

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
    }
  });
}

function isS3Configured() {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_PUBLIC_BASE_URL
  );
}

async function saveImage(file) {
  const key = buildKey(file);

  if (isS3Configured()) {
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    }));

    return {
      key,
      url: `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`,
      storage: 's3'
    };
  }

  fs.mkdirSync(localUploadDir, { recursive: true });
  const localFilename = path.basename(key);
  fs.writeFileSync(path.join(localUploadDir, localFilename), file.buffer);

  return {
    key,
    url: `/uploads/designs/${localFilename}`,
    storage: 'local'
  };
}

module.exports = { saveImage, isS3Configured };
