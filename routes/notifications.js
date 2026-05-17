const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const User = require('../models/User');
const Notification = require('../models/Notification');
const pushService = require('../services/pushService');

router.use(requireLogin);

// List notifications for current user
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.session.user.id })
      .populate('sender', 'name username')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const unreadCount = await Notification.countDocuments({ recipient: req.session.user.id, read: false });

    if (req.query.format === 'json') {
      return res.json({ notifications, unreadCount });
    }

    res.render('notifications', {
      title: 'الإشعارات',
      notifications,
      unreadCount,
      canSend: !!req.session.user.isAdmin || (req.session.user.permissions || []).includes('sendNotifications')
    });
  } catch (err) { next(err); }
});

// JSON: unread badge
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.session.user.id, read: false });
    res.json({ count });
  } catch (err) { next(err); }
});

// Mark single as read
router.post('/:id/read', async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, recipient: req.session.user.id });
    if (!notif) return res.status(404).json({ error: 'not found' });
    notif.read = true;
    notif.readAt = new Date();
    await notif.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Mark all as read
router.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.session.user.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ ok: true });
    }
    res.redirect('/notifications');
  } catch (err) { next(err); }
});

// Delete a notification
router.post('/:id/delete', async (req, res, next) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, recipient: req.session.user.id });
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ ok: true });
    }
    res.redirect('/notifications');
  } catch (err) { next(err); }
});

// Send notification (admin or sendNotifications permission)
router.post('/send', async (req, res, next) => {
  try {
    const u = req.session.user;
    const allowed = u.isAdmin || (u.permissions || []).includes('sendNotifications');
    if (!allowed) {
      return res.status(403).render('error', { title: 'غير مصرح', message: 'ليس لديك صلاحية إرسال الإشعارات.' });
    }

    const { title, body, audience, type } = req.body;
    if (!title) return res.redirect('/notifications?flash=missingTitle');

    const groupTag = audience || 'custom';
    let recipients = [];

    if (audience === 'all') {
      recipients = await User.find({ active: { $ne: false } }).select('_id').lean();
    } else if (audience === 'executives') {
      recipients = await User.find({ role: 'executive', active: { $ne: false } }).select('_id').lean();
    } else if (audience === 'employees') {
      recipients = await User.find({ role: 'employee', active: { $ne: false } }).select('_id').lean();
    } else if (audience === 'admins') {
      recipients = await User.find({ isAdmin: true, active: { $ne: false } }).select('_id').lean();
    } else if (['financial', 'media', 'content', 'followup'].includes(audience)) {
      recipients = await User.find({ department: audience, active: { $ne: false } }).select('_id').lean();
    } else {
      let ids = req.body.recipients;
      if (!ids) return res.redirect('/notifications?flash=noRecipients');
      if (!Array.isArray(ids)) ids = [ids];
      recipients = await User.find({ _id: { $in: ids }, active: { $ne: false } }).select('_id').lean();
    }

    if (!recipients.length) return res.redirect('/notifications?flash=noRecipients');

    const docs = recipients.map(r => ({
      recipient: r._id,
      sender: u.id,
      title: title.trim(),
      body: (body || '').trim(),
      type: type || 'info',
      groupTag
    }));

    const created = await Notification.insertMany(docs);
    const io = req.app.get('io');
    created.forEach(n => {
      io.to(`user:${n.recipient}`).emit('notification:new', {
        _id: n._id,
        title: n.title,
        body: n.body,
        type: n.type,
        link: '/notifications',
        createdAt: n.createdAt
      });
      pushService.sendToUser(n.recipient, {
        _id: n._id,
        title: n.title,
        body: n.body,
        type: n.type,
        link: '/notifications'
      }).catch(err => console.warn('[push] sendToUser failed:', err.message));
    });

    res.redirect('/notifications?flash=sent');
  } catch (err) { next(err); }
});

// List users (for picking recipients) — admin or sendNotifications permission only
router.get('/recipients', async (req, res, next) => {
  try {
    const u = req.session.user;
    const allowed = u.isAdmin || (u.permissions || []).includes('sendNotifications');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const users = await User.find({ active: { $ne: false } })
      .select('name username role department')
      .sort({ name: 1 })
      .lean();
    res.json({ users });
  } catch (err) { next(err); }
});

module.exports = router;
