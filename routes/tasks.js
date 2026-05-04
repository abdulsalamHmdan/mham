const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Task = require('../models/Task');

router.use(requireLogin);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const tasks = await Task.find({ owner: userId }).sort({ status: 1, dueDate: 1 }).lean();
    res.render('tasks', { title: 'مهامي', tasks });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
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
    await Task.deleteOne({ _id: req.params.id, owner: req.session.user.id });
    req.app.get('io').emit('tasks:updated');
    res.redirect('/tasks');
  } catch (err) { next(err); }
});

module.exports = router;
