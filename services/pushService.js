const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT     = process.env.VAPID_SUBJECT     || 'mailto:admin@example.com';

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
} else {
  console.warn('[push] VAPID keys not configured — web push disabled.');
}

function isConfigured() { return configured; }
function getPublicKey() { return PUBLIC_KEY; }

async function sendToUser(userId, payload) {
  if (!configured) return { sent: 0, failed: 0, skipped: true };
  const subs = await PushSubscription.find({ user: userId }).lean();
  if (!subs.length) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.title || 'إشعار جديد',
    body:  payload.body  || '',
    type:  payload.type  || 'info',
    link:  payload.link  || '/notifications',
    _id:   payload._id   || null,
    icon:  '/img/logo.png',
    badge: '/img/logo.png',
    tag:   payload._id ? String(payload._id) : undefined
  });

  let sent = 0, failed = 0;
  const removeIds = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        keys: s.keys
      }, body, { TTL: 60 * 60 * 24 });
      sent++;
      PushSubscription.updateOne({ _id: s._id }, { $set: { lastUsedAt: new Date(), failures: 0 } }).catch(()=>{});
    } catch (err) {
      failed++;
      const code = err && err.statusCode;
      if (code === 404 || code === 410) {
        removeIds.push(s._id);
      } else {
        PushSubscription.updateOne({ _id: s._id }, { $inc: { failures: 1 } }).catch(()=>{});
      }
      console.warn('[push] send failed:', code, err && err.body ? err.body : err && err.message);
    }
  }));
  if (removeIds.length) {
    await PushSubscription.deleteMany({ _id: { $in: removeIds } });
  }
  return { sent, failed };
}

module.exports = { isConfigured, getPublicKey, sendToUser };
