function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== role) {
      return res.status(403).render('error', { title: 'غير مصرح', message: 'ليس لديك صلاحية الوصول لهذه الصفحة.' });
    }
    next();
  };
}

function requireDepartment(department) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.department !== department && req.session.user.role !== 'executive') {
      return res.status(403).render('error', { title: 'غير مصرح', message: 'هذا القسم ليس ضمن صلاحياتك.' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole, requireDepartment };
