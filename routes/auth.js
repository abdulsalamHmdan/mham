const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role === 'executive') return res.redirect('/dashboard');
  return res.redirect('/employee');
});

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'executive' ? '/dashboard' : '/employee');
  }
  res.render('login', { title: 'تسجيل الدخول', error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: (username || '').toLowerCase().trim() });
    if (!user || !(await user.verifyPassword(password || ''))) {
      return res.render('login', { title: 'تسجيل الدخول', error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department || null
    };
    res.redirect(user.role === 'executive' ? '/dashboard' : '/employee');
  } catch (err) {
    res.render('login', { title: 'تسجيل الدخول', error: 'حدث خطأ أثناء تسجيل الدخول.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
