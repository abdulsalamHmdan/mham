const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  majorDonors: { type: Number, default: 0, min: 0 },
  donationPlatform: { type: Number, default: 0, min: 0 },
  donationKiosk: { type: Number, default: 0, min: 0 },
  grantOrganizations: { type: Number, default: 0, min: 0 },
  governmentSupport: { type: Number, default: 0, min: 0 },
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

revenueSchema.virtual('total').get(function () {
  return (
    (this.majorDonors || 0) +
    (this.donationPlatform || 0) +
    (this.donationKiosk || 0) +
    (this.grantOrganizations || 0) +
    (this.governmentSupport || 0)
  );
});

revenueSchema.set('toJSON', { virtuals: true });
revenueSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Revenue', revenueSchema);
