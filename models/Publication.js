const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  count: { type: Number, default: 0, min: 0 },
  platform: { type: String, default: '' },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Publication', publicationSchema);
