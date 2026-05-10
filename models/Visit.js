const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  associationToExternal: { type: Number, default: 0, min: 0 },
  externalToAssociation: { type: Number, default: 0, min: 0 },
  websiteVisits: { type: Number, default: 0, min: 0 },
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

visitSchema.virtual('total').get(function () {
  return (this.associationToExternal || 0) + (this.externalToAssociation || 0) + (this.websiteVisits || 0);
});

visitSchema.set('toJSON', { virtuals: true });
visitSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Visit', visitSchema);
