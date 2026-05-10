const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Design = require('../models/Design');
const Publication = require('../models/Publication');
const Visit = require('../models/Visit');
const { currentWeekDateFilter, getCurrentWeekRange, formatDateInput, formatWeekLabel } = require('../utils/week');
const { getDisqRevenueAmount } = require('../services/disqRevenue');
const { saveImage } = require('../services/imageStorage');

router.use(requireRole('employee'));

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

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
    const disqRevenue = dept === 'financial' ? await getDisqRevenueAmount() : 0;
    res.render('employee', {
      title: `لوحة قسم ${DEPT_LABELS[dept]}`,
      department: dept,
      departmentLabel: DEPT_LABELS[dept],
      recent,
      financialEntry: dept === 'financial' ? (recent[0] || null) : null,
      disqRevenue,
      weekLabel: formatWeekLabel(weekRange),
      weekStartInput: formatDateInput(weekRange.start),
      weekEndInput: formatDateInput(new Date(weekRange.end.getTime() - 1)),
      todayInput: formatDateInput(new Date()),
      success: req.query.success === '1',
      outsideWeek: req.query.outsideWeek === '1'
    });
  } catch (err) { next(err); }
});

router.post('/submit', upload.single('image'), async (req, res, next) => {
  try {
    const dept = req.session.user.department;
    const userId = req.session.user.id;
    const weekRange = getCurrentWeekRange();
    const entryDate = dept === 'financial'
      ? weekRange.start
      : (req.body.date ? new Date(req.body.date) : new Date());
    if (entryDate < weekRange.start || entryDate >= weekRange.end) {
      return res.redirect('/employee?outsideWeek=1');
    }
    let doc;

    if (dept === 'financial') {
      doc = await Revenue.findOneAndUpdate(
        {
          addedBy: userId,
          date: { $gte: weekRange.start, $lt: weekRange.end }
        },
        {
          $set: {
            majorDonors: Number(req.body.majorDonors) || 0,
            donationPlatform: 0,
            donationKiosk: Number(req.body.donationKiosk) || 0,
            grantOrganizations: Number(req.body.grantOrganizations) || 0,
            governmentSupport: Number(req.body.governmentSupport) || 0,
            note: req.body.note || '',
            date: entryDate,
            addedBy: userId
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else if (dept === 'media') {
      if (!req.file || !req.body.title) {
        return res.redirect('/employee');
      }
      const image = await saveImage(req.file);

      doc = await Design.create({
        count: 1,
        title: req.body.title.trim(),
        imagePath: image.url,
        imageKey: image.key,
        imageStorage: image.storage,
        imageOriginalName: req.file.originalname,
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
