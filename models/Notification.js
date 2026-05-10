const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title: { type: String, required: true, trim: true },
  body: { type: String, default: '' },
  type: { type: String, enum: ['info', 'task', 'system', 'alert'], default: 'info' },
  link: { type: String, default: '' },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  groupTag: { type: String, default: '' }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
