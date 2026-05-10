const mongoose = require('mongoose');

const designSchema = new mongoose.Schema({
  count: { type: Number, default: 1, min: 0 },
  title: { type: String, required: true, trim: true },
  imagePath: { type: String, default: '' },
  imageKey: { type: String, default: '' },
  imageStorage: { type: String, enum: ['local', 's3'], default: 'local' },
  imageOriginalName: { type: String, default: '' },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Design', designSchema);
