require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;

const users = [
  { name: 'المدير التنفيذي', username: 'executive', password: '123456', role: 'executive' },
  { name: 'موظف الموارد المالية', username: 'financial', password: '123456', role: 'employee', department: 'financial' },
  { name: 'موظف الإعلام', username: 'media', password: '123456', role: 'employee', department: 'media' },
  { name: 'موظف المحتوى', username: 'content', password: '123456', role: 'employee', department: 'content' },
  { name: 'موظف المتابعة', username: 'followup', password: '123456', role: 'employee', department: 'followup' }
];

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('متصل بقاعدة البيانات');
    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (exists) { console.log(`- موجود: ${u.username}`); continue; }
      const passwordHash = await User.hashPassword(u.password);
      await User.create({
        name: u.name, username: u.username, passwordHash,
        role: u.role, department: u.department
      });
      console.log(`+ تم إنشاء: ${u.username} / ${u.password}`);
    }
    console.log('\n✓ انتهت تعبئة المستخدمين الافتراضيين');
    process.exit(0);
  } catch (e) {
    console.error('فشل seed:', e.message);
    process.exit(1);
  }
})();
