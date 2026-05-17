require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;

// Username الذي يبقى مشرف نظام
const KEEP_ADMIN = 'hamad.albudaiwi';

// كل أعضاء الفريق ما عدا المشرف يصبحون موظفي إدخال فقط
const TEAM = [
  'abdullah.alobaiki',
  'abdulsalam.alsharqi',
  'hamad.alnoqaidan',
  'majed.almaroul',
  'abdullah.aldubayyan',
  'saleh.aldamigh',
  'abdulaziz.aljaber',
  'abdulaziz.alhumaidi',
  'humood.aljunaini',
  'mohammed.alhawas'
];

const SUBMIT_PERMISSIONS = [
  'submitFinancial',
  'submitMedia',
  'submitContent',
  'submitFollowup'
];

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('متصل بقاعدة البيانات\n');

    // ضمان أن البديوي مشرف نظام بكافة الصلاحيات
    const admin = await User.findOne({ username: KEEP_ADMIN });
    if (admin) {
      admin.role = 'executive';
      admin.isAdmin = true;
      admin.permissions = User.ALL_PERMISSIONS;
      admin.department = undefined;
      await admin.save();
      console.log(`★ ${KEEP_ADMIN}: مشرف نظام (تنفيذي + كل الصلاحيات)`);
    } else {
      console.warn(`! لم يتم العثور على ${KEEP_ADMIN}`);
    }

    // البقية → موظفين بصلاحيات الإدخال فقط
    for (const username of TEAM) {
      const u = await User.findOne({ username });
      if (!u) {
        console.warn(`! غير موجود: ${username}`);
        continue;
      }
      u.role = 'employee';
      u.isAdmin = false;
      u.permissions = SUBMIT_PERMISSIONS;
      // قسم افتراضي مطلوب على نموذج الموظف؛ احتفظ بالحالي إن وُجد، وإلا 'media'
      if (!u.department) u.department = 'media';
      await u.save();
      console.log(`~ ${username}: موظف إدخال (قسم: ${u.department})`);
    }

    console.log('\n✓ تم تحديث الأدوار والصلاحيات');
    process.exit(0);
  } catch (e) {
    console.error('فشل التحديث:', e.message);
    process.exit(1);
  }
})();
