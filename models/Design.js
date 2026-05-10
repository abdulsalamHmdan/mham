const mongoose = require('mongoose');

const designSchema = new mongoose.Schema({
  count: { type: Number, default: 1, min: 0 },
  title: { type: String, required: true, trim: true },
  imagePath: { type: String, default: '' },
  imageKey: { type: String, default: '' },
  imageStorage: { type: String, enum: ['r2', 's3', 'local'], default: 'r2' },
  imageOriginalName: { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', 'pdf'], default: 'image' },
  mimetype: { type: String, default: '' },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Design', designSchema);
