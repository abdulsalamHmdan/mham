const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');
const pushService = require('../services/pushService');

router.get('/public-key', (req, res) => {
  res.json({
    publicKey: pushService.getPublicKey(),
    configured: pushService.isConfigured()
  });
});

router.use(requireLogin);

// Save a new subscription
router.post('/subscribe', async (req, res, next) => {
  try {
    if (!pushService.isConfigured()) return res.status(503).json({ error: 'push not configured' });
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'invalid subscription' });
    }
    const userAgent = (req.headers['user-agent'] || '').slice(0, 300);
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          user: req.session.user.id,
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent,
          failures: 0,
          lastUsedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Remove a subscription (used on logout / manual disable)
router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await PushSubscription.deleteOne({ endpoint, user: req.session.user.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Send a test push to the logged-in user — useful for debugging
router.post('/test', async (req, res, next) => {
  try {
    if (!pushService.isConfigured()) return res.status(503).json({ error: 'push not configured' });
    const subs = await PushSubscription.countDocuments({ user: req.session.user.id });
    if (!subs) return res.status(400).json({ error: 'no subscriptions', subs: 0 });
    const result = await pushService.sendToUser(req.session.user.id, {
      title: 'إشعار اختبار',
      body: 'إذا وصلك هذا الإشعار، فإن النظام يعمل بشكل صحيح.',
      type: 'system',
      link: '/notifications'
    });
    res.json({ ok: true, subs, ...result });
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    const subs = await PushSubscription.countDocuments({ user: req.session.user.id });
    res.json({
      configured: pushService.isConfigured(),
      subscriptions: subs
    });
  } catch (err) { next(err); }
});

module.exports = router;
