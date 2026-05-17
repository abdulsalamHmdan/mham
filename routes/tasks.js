const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const pushService = require('../services/pushService');

router.use(requireLogin);

router.get('/', async (req, res, next) => {
  try {
    const isExecutive = req.session.user.role === 'executive';
    const isAdmin = req.session.user.isAdmin;
    let tasks;

    if (isAdmin) {
      tasks = await Task.find()
        .populate('owner', 'name department role')
        .populate('assignedBy', 'name')
        .sort({ owner: 1, status: 1, dueDate: 1 })
        .lean();
    } else if (isExecutive) {
      const employees = await User.find({ role: 'employee' }).select('_id').lean();
      tasks = await Task.find({ owner: { $in: employees.map((employee) => employee._id) } })
        .populate('owner', 'name department role')
        .sort({ owner: 1, status: 1, dueDate: 1 })
        .lean();
    } else {
      tasks = await Task.find({ owner: req.session.user.id })
        .sort({ status: 1, dueDate: 1 })
        .lean();
    }

    res.render('tasks', {
      title: isExecutive ? 'متابعة المهام' : 'مهامي',
      tasks,
      isExecutive
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    if (req.session.user.role === 'executive') return res.status(403).redirect('/tasks');
    const { title, description, dueDate } = req.body;
    if (!title || !dueDate) return res.redirect('/tasks');
    await Task.create({
      title: title.trim(),
      description: (description || '').trim(),
      dueDate: new Date(dueDate),
      owner: req.session.user.id
    });
    req.app.get('io').emit('tasks:updated');
    res.redirect('/tasks');
  } catch (err) { next(err); }
});

router.post('/:id/toggle', async (req, res, next) => {
  try {
    if (req.session.user.role === 'executive') return res.status(403).json({ error: 'read only' });
    const task = await Task.findOne({ _id: req.params.id, owner: req.session.user.id });
    if (!task) return res.status(404).json({ error: 'not found' });
    if (task.status === 'done') {
      task.status = 'pending';
      task.completedAt = null;
    } else {
      task.status = 'done';
      task.completedAt = new Date();
    }
    await task.save();
    req.app.get('io').emit('tasks:updated');
    res.json({ ok: true, status: task.status, completedAt: task.completedAt });
  } catch (err) { next(err); }
});

router.post('/:id/notify', async (req, res, next) => {
  try {
    const u = req.session.user;
    const allowed = u.role === 'executive' || u.isAdmin || (u.permissions || []).includes('sendNotifications');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });

    const task = await Task.findById(req.params.id).populate('owner', 'name');
    if (!task || !task.owner) return res.status(404).json({ error: 'not found' });
    if (String(task.owner._id) === String(u.id)) {
      return res.status(400).json({ error: 'cannot notify yourself' });
    }

    const title = (req.body.title || '').toString().trim();
    const body  = (req.body.body  || '').toString().trim();
    if (!title) return res.status(400).json({ error: 'missing title' });
    if (title.length > 160) return res.status(400).json({ error: 'title too long' });
    if (body.length  > 800) return res.status(400).json({ error: 'body too long' });

    const notif = await Notification.create({
      recipient: task.owner._id,
      sender: u.id,
      title,
      body: body || `بخصوص المهمة: ${task.title}`,
      type: 'task',
      link: '/tasks',
      groupTag: 'task'
    });

    const io = req.app.get('io');
    io.to(`user:${task.owner._id}`).emit('notification:new', {
      _id: notif._id,
      title: notif.title,
      body: notif.body,
      type: notif.type,
      link: notif.link,
      createdAt: notif.createdAt
    });
    const pushResult = await pushService.sendToUser(task.owner._id, {
      _id: notif._id,
      title: notif.title,
      body: notif.body,
      type: notif.type,
      link: notif.link
    }).catch(err => { console.warn('[push] task notify failed:', err.message); return { sent: 0, failed: 0 }; });

    res.json({ ok: true, push: pushResult });
  } catch (err) { next(err); }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    if (req.session.user.role === 'executive') return res.status(403).redirect('/tasks');
    await Task.deleteOne({ _id: req.params.id, owner: req.session.user.id });
    req.app.get('io').emit('tasks:updated');
    res.redirect('/tasks');
  } catch (err) { next(err); }
});

module.exports = router;
