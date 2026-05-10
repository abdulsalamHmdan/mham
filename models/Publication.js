const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  count: { type: Number, default: 0, min: 0 },
  platform: { type: String, default: '' },
  note: { type: String, default: '' },
  evidenceType: { type: String, default: '' },
  evidenceText: { type: String, default: '' },
  evidencePath: { type: String, default: '' },
  evidenceKey: { type: String, default: '' },
  evidenceStorage: { type: String, default: '' },
  evidenceMediaType: { type: String, default: '' },
  evidenceMimetype: { type: String, default: '' },
  evidenceOriginalName: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Publication', publicationSchema);
