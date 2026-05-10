const path = require('path');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

const MIME_EXT_FALLBACK = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf'
};

function getMediaType(mimetype) {
  if (!mimetype) return null;
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'pdf';
  return null;
}

function safeExtension(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext) return ext;
  return MIME_EXT_FALLBACK[file.mimetype] || '';
}

function buildKey(file) {
  return `designs/${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension(file)}`;
}

function requireEnv() {
  const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'S3_PUBLIC_BASE_URL']
    .filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`R2 غير مهيأ — متغيرات البيئة المفقودة: ${missing.join(', ')}`);
  }
}

let _client = null;
function getS3Client() {
  if (_client) return _client;
  requireEnv();
  const agent = new https.Agent({
    keepAlive: true,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3'
  });
  _client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    },
    requestHandler: new NodeHttpHandler({
      httpsAgent: agent,
      connectionTimeout: 10000,
      requestTimeout: 60000
    })
  });
  return _client;
}

async function saveFile(file) {
  requireEnv();
  const key = buildKey(file);
  const mediaType = getMediaType(file.mimetype);

  await getS3Client().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  return {
    key,
    url: `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`,
    storage: 'r2',
    mediaType,
    mimetype: file.mimetype
  };
}

module.exports = { saveFile, saveImage: saveFile, getMediaType };
