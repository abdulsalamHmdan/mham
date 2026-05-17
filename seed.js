require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { ALL_PERMISSIONS } = User;

const MONGODB_URI = process.env.MONGODB_URI;

const baseUsers = [
  { name: 'المدير التنفيذي', username: 'executive', password: '123456', role: 'executive' },
  { name: 'موظف الموارد المالية', username: 'financial', password: '123456', role: 'employee', department: 'financial' },
  { name: 'موظف الإعلام', username: 'media', password: '123456', role: 'employee', department: 'media' },
  { name: 'موظف المحتوى', username: 'content', password: '123456', role: 'employee', department: 'content' },
  { name: 'موظف المتابعة', username: 'followup', password: '123456', role: 'employee', department: 'followup' }
];

const SUBMIT_PERMS = ['submitFinancial', 'submitMedia', 'submitContent', 'submitFollowup'];

// المشرف الوحيد: حمد البديوي — تنفيذي + كل الصلاحيات
const adminTeam = [
  { name: 'حمد البديوي', username: 'hamad.albudaiwi', password: '123456', role: 'executive', isAdmin: true, permissions: [...ALL_PERMISSIONS] }
];

// موظفو الإدخال — صلاحيات إدخال البيانات فقط
const inputTeam = [
  { name: 'عبدالله العبيكي',   username: 'abdullah.alobaiki',   department: 'followup'  },
  { name: 'عبدالسلام الشرقي',  username: 'abdulsalam.alsharqi', department: 'financial' },
  { name: 'حمد النقيدان',      username: 'hamad.alnoqaidan',    department: 'financial' },
  { name: 'ماجد المرعول',      username: 'majed.almaroul',      department: 'financial' },
  { name: 'عبدالله الدبيان',   username: 'abdullah.aldubayyan', department: 'media'     },
  { name: 'صالح الدامغ',       username: 'saleh.aldamigh',      department: 'media'     },
  { name: 'عبدالعزيز الجابر',  username: 'abdulaziz.aljaber',   department: 'media'     },
  { name: 'عبدالعزيز الحميدي', username: 'abdulaziz.alhumaidi', department: 'media'     },
  { name: 'حمود الجنيني',      username: 'humood.aljunaini',    department: 'media'     },
  { name: 'محمد الحواس',       username: 'mohammed.alhawas',    department: 'media'     }
].map(u => ({
  ...u,
  password: '123456',
  role: 'employee',
  isAdmin: false,
  permissions: [...SUBMIT_PERMS]
}));

const users = [...baseUsers, ...adminTeam, ...inputTeam];

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('متصل بقاعدة البيانات');
    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (exists) {
        let changed = false;
        if (u.isAdmin && !exists.isAdmin) { exists.isAdmin = true; changed = true; }
        if (u.permissions && (!exists.permissions || exists.permissions.length === 0)) {
          exists.permissions = u.permissions; changed = true;
        }
        if (changed) {
          await exists.save();
          console.log(`~ تم تحديث الصلاحيات: ${u.username}`);
        } else {
          console.log(`- موجود: ${u.username}`);
        }
        continue;
      }
      const passwordHash = await User.hashPassword(u.password);
      await User.create({
        name: u.name,
        username: u.username,
        passwordHash,
        role: u.role,
        department: u.department,
        isAdmin: !!u.isAdmin,
        permissions: u.permissions || []
      });
      console.log(`+ تم إنشاء: ${u.username} / ${u.password}`);
    }
    console.log('\n✓ انتهت تعبئة المستخدمين');
    process.exit(0);
  } catch (e) {
    console.error('فشل seed:', e.message);
    process.exit(1);
  }
})();
