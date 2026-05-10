const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Task = require('../models/Task');
const User = require('../models/User');

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

router.post('/:id/delete', async (req, res, next) => {
  try {
    if (req.session.user.role === 'executive') return res.status(403).redirect('/tasks');
    await Task.deleteOne({ _id: req.params.id, owner: req.session.user.id });
    req.app.get('io').emit('tasks:updated');
    res.redirect('/tasks');
  } catch (err) { next(err); }
});

module.exports = router;
