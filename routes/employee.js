const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Design = require('../models/Design');
const Publication = require('../models/Publication');
const Visit = require('../models/Visit');
const { currentWeekDateFilter, getCurrentWeekRange, formatDateInput, formatWeekLabel } = require('../utils/week');

router.use(requireRole('employee'));

const MODELS = {
  financial: Revenue,
  media: Design,
  content: Publication,
  followup: Visit
};

const DEPT_LABELS = {
  financial: 'تنمية الموارد المالية',
  media: 'الإعلام',
  content: 'المحتوى المنشور',
  followup: 'المتابعة'
};

router.get('/', async (req, res, next) => {
  try {
    const dept = req.session.user.department;
    const Model = MODELS[dept];
    const weekRange = getCurrentWeekRange();
    const recent = await Model.find({
      addedBy: req.session.user.id,
      ...currentWeekDateFilter()
    }).sort({ date: -1, createdAt: -1 }).limit(10).lean();
    res.render('employee', {
      title: `لوحة قسم ${DEPT_LABELS[dept]}`,
      department: dept,
      departmentLabel: DEPT_LABELS[dept],
      recent,
      weekLabel: formatWeekLabel(weekRange),
      weekStartInput: formatDateInput(weekRange.start),
      weekEndInput: formatDateInput(new Date(weekRange.end.getTime() - 1)),
      todayInput: formatDateInput(new Date()),
      success: req.query.success === '1',
      outsideWeek: req.query.outsideWeek === '1'
    });
  } catch (err) { next(err); }
});

router.post('/submit', async (req, res, next) => {
  try {
    const dept = req.session.user.department;
    const userId = req.session.user.id;
    const weekRange = getCurrentWeekRange();
    const entryDate = req.body.date ? new Date(req.body.date) : new Date();
    if (entryDate < weekRange.start || entryDate >= weekRange.end) {
      return res.redirect('/employee?outsideWeek=1');
    }
    let doc;

    if (dept === 'financial') {
      doc = await Revenue.create({
        majorDonors: Number(req.body.majorDonors) || 0,
        donationPlatform: Number(req.body.donationPlatform) || 0,
        donationKiosk: Number(req.body.donationKiosk) || 0,
        note: req.body.note || '',
        date: entryDate,
        addedBy: userId
      });
    } else if (dept === 'media') {
      doc = await Design.create({
        count: Number(req.body.count) || 0,
        title: req.body.title || '',
        note: req.body.note || '',
        date: entryDate,
        addedBy: userId
      });
    } else if (dept === 'content') {
      doc = await Publication.create({
        count: Number(req.body.count) || 0,
        platform: req.body.platform || '',
        note: req.body.note || '',
        date: entryDate,
        addedBy: userId
      });
    } else if (dept === 'followup') {
      doc = await Visit.create({
        associationToExternal: Number(req.body.associationToExternal) || 0,
        externalToAssociation: Number(req.body.externalToAssociation) || 0,
        websiteVisits: Number(req.body.websiteVisits) || 0,
        note: req.body.note || '',
        date: entryDate,
        addedBy: userId
      });
    }

    const io = req.app.get('io');
    io.emit('data:updated', { department: dept });

    res.redirect('/employee?success=1');
  } catch (err) { next(err); }
});

module.exports = router;
