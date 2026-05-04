const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  majorDonors: { type: Number, default: 0, min: 0 },
  donationPlatform: { type: Number, default: 0, min: 0 },
  donationKiosk: { type: Number, default: 0, min: 0 },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

revenueSchema.virtual('total').get(function () {
  return (this.majorDonors || 0) + (this.donationPlatform || 0) + (this.donationKiosk || 0);
});

revenueSchema.set('toJSON', { virtuals: true });
revenueSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Revenue', revenueSchema);
