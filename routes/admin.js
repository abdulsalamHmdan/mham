const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { ALL_PERMISSIONS, DEPARTMENTS, ROLES } = User;

router.use(requireAdmin);

const PERMISSION_LABELS = {
  viewDashboard: 'عرض لوحة القيادة',
  submitFinancial: 'إدخال بيانات الموارد المالية',
  submitMedia: 'إدخال بيانات الإعلام',
  submitContent: 'إدخال بيانات المحتوى',
  submitFollowup: 'إدخال بيانات المتابعة',
  manageTasks: 'إسناد ومتابعة المهام',
  sendNotifications: 'إرسال الإشعارات',
  manageUsers: 'إدارة المستخدمين'
};

const DEPARTMENT_LABELS = {
  financial: 'تنمية الموارد المالية',
  media: 'الإعلام',
  content: 'المحتوى المنشور',
  followup: 'المتابعة'
};

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1 }).lean();
    const tasks = await Task.find()
      .populate('owner', 'name username department role')
      .populate('assignedBy', 'name username')
      .sort({ status: 1, dueDate: 1 })
      .lean();

    res.render('admin', {
      title: 'لوحة الإدارة',
      users,
      tasks,
      permissions: ALL_PERMISSIONS,
      permissionLabels: PERMISSION_LABELS,
      departments: DEPARTMENTS,
      departmentLabels: DEPARTMENT_LABELS,
      roles: ROLES,
      flash: req.query.flash || ''
    });
  } catch (err) { next(err); }
});

// Create new user
router.post('/users', async (req, res, next) => {
  try {
    const { name, username, password, role, department, isAdmin } = req.body;
    if (!name || !username || !password || !role) {
      return res.redirect('/admin?flash=missingFields');
    }
    const cleanUsername = String(username).toLowerCase().trim();
    const exists = await User.findOne({ username: cleanUsername });
    if (exists) return res.redirect('/admin?flash=userExists');

    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p))
      : (req.body.permissions ? [req.body.permissions] : []);

    const passwordHash = await User.hashPassword(password);
    await User.create({
      name: name.trim(),
      username: cleanUsername,
      passwordHash,
      role,
      department: role === 'employee' ? department : undefined,
      isAdmin: !!isAdmin,
      permissions
    });
    res.redirect('/admin?flash=userCreated');
  } catch (err) { next(err); }
});

// Update user
router.post('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/admin?flash=notFound');

    const { name, role, department, isAdmin, active, password } = req.body;
    if (name) user.name = name.trim();
    if (role && ROLES.includes(role)) user.role = role;
    if (role === 'employee' && department && DEPARTMENTS.includes(department)) {
      user.department = department;
    } else if (role === 'executive') {
      user.department = undefined;
    }
    user.isAdmin = !!isAdmin;
    user.active = active === undefined ? true : !!active;

    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p))
      : (req.body.permissions ? [req.body.permissions] : []);
    user.permissions = permissions;

    if (password && password.trim()) {
      user.passwordHash = await User.hashPassword(password.trim());
    }

    await user.save();
    res.redirect('/admin?flash=userUpdated');
  } catch (err) { next(err); }
});

// Delete user
router.post('/users/:id/delete', async (req, res, next) => {
  try {
    if (req.params.id === req.session.user.id) {
      return res.redirect('/admin?flash=cantDeleteSelf');
    }
    await User.deleteOne({ _id: req.params.id });
    res.redirect('/admin?flash=userDeleted');
  } catch (err) { next(err); }
});

// Assign task to user(s)
router.post('/tasks', async (req, res, next) => {
  try {
    const { title, description, dueDate } = req.body;
    if (!title || !dueDate) return res.redirect('/admin?flash=missingFields');

    let owners = req.body.owners;
    if (!owners) return res.redirect('/admin?flash=missingFields');
    if (!Array.isArray(owners)) owners = [owners];

    const created = [];
    for (const ownerId of owners) {
      const owner = await User.findById(ownerId);
      if (!owner) continue;
      const task = await Task.create({
        title: title.trim(),
        description: (description || '').trim(),
        dueDate: new Date(dueDate),
        owner: owner._id,
        assignedBy: req.session.user.id
      });
      created.push({ owner, task });
    }

    // Create notifications for each owner
    const io = req.app.get('io');
    for (const { owner, task } of created) {
      const notif = await Notification.create({
        recipient: owner._id,
        sender: req.session.user.id,
        title: 'تم إسناد مهمة جديدة لك',
        body: task.title,
        type: 'task',
        link: '/tasks'
      });
      io.to(`user:${owner._id}`).emit('notification:new', {
        _id: notif._id,
        title: notif.title,
        body: notif.body,
        type: notif.type,
        link: notif.link,
        createdAt: notif.createdAt
      });
    }

    io.emit('tasks:updated');
    res.redirect('/admin?flash=tasksAssigned');
  } catch (err) { next(err); }
});

// Delete a task (admin)
router.post('/tasks/:id/delete', async (req, res, next) => {
  try {
    await Task.deleteOne({ _id: req.params.id });
    req.app.get('io').emit('tasks:updated');
    res.redirect('/admin?flash=taskDeleted');
  } catch (err) { next(err); }
});

module.exports = router;
