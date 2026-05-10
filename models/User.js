const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DEPARTMENTS = ['financial', 'media', 'content', 'followup'];
const ROLES = ['executive', 'employee'];

const ALL_PERMISSIONS = [
  'viewDashboard',
  'submitFinancial',
  'submitMedia',
  'submitContent',
  'submitFollowup',
  'manageTasks',
  'sendNotifications',
  'manageUsers'
];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  department: { type: String, enum: DEPARTMENTS, required: function () { return this.role === 'employee'; } },
  isAdmin: { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
  active: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = mongoose.model('User', userSchema);
module.exports.DEPARTMENTS = DEPARTMENTS;
module.exports.ROLES = ROLES;
module.exports.ALL_PERMISSIONS = ALL_PERMISSIONS;
