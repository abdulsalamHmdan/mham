const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  evidenceType: { type: String, enum: ['none', 'text', 'media'], default: 'none' },
  evidenceText: { type: String, default: '' },
  evidencePath: { type: String, default: '' },
  evidenceKey: { type: String, default: '' },
  evidenceStorage: { type: String, enum: ['r2', 's3', 'local', ''], default: '' },
  evidenceMediaType: { type: String, enum: ['image', 'video', 'pdf', ''], default: '' },
  evidenceMimetype: { type: String, default: '' },
  evidenceOriginalName: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Achievement', achievementSchema);
