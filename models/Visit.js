const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  associationToExternal: { type: Number, default: 0, min: 0 },
  externalToAssociation: { type: Number, default: 0, min: 0 },
  websiteVisits: { type: Number, default: 0, min: 0 },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

visitSchema.virtual('total').get(function () {
  return (this.associationToExternal || 0) + (this.externalToAssociation || 0) + (this.websiteVisits || 0);
});

visitSchema.set('toJSON', { virtuals: true });
visitSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Visit', visitSchema);
