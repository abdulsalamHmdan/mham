const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Design = require('../models/Design');
const Publication = require('../models/Publication');
const Visit = require('../models/Visit');
const { currentWeekDateFilter, getCurrentWeekRange, formatDateInput, formatWeekLabel } = require('../utils/week');
const { saveFile, getMediaType } = require('../services/imageStorage');

router.use(requireRole('employee'));

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    cb(null, Boolean(getMediaType(file.mimetype)));
  },
  limits: { fileSize: 50 * 1024 * 1024 }
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

const VALID_SECTIONS = Object.keys(MODELS);

router.get('/', async (req, res, next) => {
  try {
    const section = VALID_SECTIONS.includes(req.query.section) ? req.query.section : null;
    const weekRange = getCurrentWeekRange();

    let recent = [];
    if (section) {
      const Model = MODELS[section];
      recent = await Model.find({
        addedBy: req.session.user.id,
        ...currentWeekDateFilter()
      }).sort({ date: -1, createdAt: -1 }).limit(10).lean();
    }

    res.render('employee', {
      title: section ? `إضافة بيانات — ${DEPT_LABELS[section]}` : 'إدخال البيانات',
      section,
      sections: VALID_SECTIONS.map(key => ({ key, label: DEPT_LABELS[key] })),
      departmentLabel: section ? DEPT_LABELS[section] : '',
      recent,
      weekLabel: formatWeekLabel(weekRange),
      weekStartInput: formatDateInput(weekRange.start),
      weekEndInput: formatDateInput(new Date(weekRange.end.getTime() - 1)),
      todayInput: formatDateInput(new Date()),
      success: req.query.success === '1',
      outsideWeek: req.query.outsideWeek === '1',
      uploadError: req.query.uploadError || ''
    });
  } catch (err) { next(err); }
});

function handleUpload(req, res, next) {
  const handler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'evidenceFile', maxCount: 1 }
  ]);
  handler(req, res, (err) => {
    if (err) {
      const section = req.body && req.body.department ? req.body.department : 'media';
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'tooLarge' : 'badFile';
      return res.redirect(`/employee?section=${section}&uploadError=${code}`);
    }
    next();
  });
}

async function buildEvidence(req, section) {
  const type = req.body.evidenceType;
  if (type === 'text') {
    return { evidenceType: 'text', evidenceText: req.body.evidenceText || '' };
  }
  if (type === 'media') {
    const file = req.files && req.files.evidenceFile && req.files.evidenceFile[0];
    if (!file) return { _error: 'noEvidenceFile' };
    let saved;
    try { saved = await saveFile(file); }
    catch (e) { console.error('R2 evidence upload failed:', e); return { _error: 'storage' }; }
    return {
      evidenceType: 'media',
      evidencePath: saved.url,
      evidenceKey: saved.key,
      evidenceStorage: saved.storage,
      evidenceMediaType: saved.mediaType,
      evidenceMimetype: saved.mimetype,
      evidenceOriginalName: file.originalname
    };
  }
  return {};
}

router.post('/submit', handleUpload, async (req, res, next) => {
  try {
    const section = VALID_SECTIONS.includes(req.body.department) ? req.body.department : null;
    if (!section) return res.redirect('/employee');

    const userId = req.session.user.id;
    const weekRange = getCurrentWeekRange();
    const entryDate = req.body.date ? new Date(req.body.date) : new Date();
    if (entryDate < weekRange.start || entryDate >= weekRange.end) {
      return res.redirect(`/employee?section=${section}&outsideWeek=1`);
    }

    if (section === 'financial') {
      const REVENUE_FIELDS = ['majorDonors', 'donationPlatform', 'donationKiosk', 'grantOrganizations', 'governmentSupport'];
      const revenueType = REVENUE_FIELDS.includes(req.body.revenueType) ? req.body.revenueType : null;
      const amount = Number(req.body.amount) || 0;
      if (!revenueType || amount <= 0) {
        return res.redirect(`/employee?section=${section}`);
      }
      const evidence = await buildEvidence(req, section);
      if (evidence._error) return res.redirect(`/employee?section=${section}&uploadError=${evidence._error}`);
      const doc = {
        majorDonors: 0,
        donationPlatform: 0,
        donationKiosk: 0,
        grantOrganizations: 0,
        governmentSupport: 0,
        date: entryDate,
        addedBy: userId,
        ...evidence
      };
      doc[revenueType] = amount;
      await Revenue.create(doc);
    } else if (section === 'media') {
      const file = req.files && req.files.image && req.files.image[0];
      if (!file) {
        return res.redirect(`/employee?section=${section}&uploadError=noFile`);
      }
      if (!req.body.title) {
        return res.redirect(`/employee?section=${section}&uploadError=noTitle`);
      }
      let saved;
      try {
        saved = await saveFile(file);
      } catch (e) {
        console.error('R2 upload failed:', e);
        return res.redirect(`/employee?section=${section}&uploadError=storage`);
      }
      await Design.create({
        count: 1,
        title: req.body.title.trim(),
        imagePath: saved.url,
        imageKey: saved.key,
        imageStorage: saved.storage,
        imageOriginalName: file.originalname,
        mediaType: saved.mediaType,
        mimetype: saved.mimetype,
        note: req.body.note || '',
        date: entryDate,
        addedBy: userId
      });
    } else if (section === 'content') {
      const evidence = await buildEvidence(req, section);
      if (evidence._error) return res.redirect(`/employee?section=${section}&uploadError=${evidence._error}`);
      await Publication.create({
        count: Number(req.body.count) || 0,
        platform: req.body.platform || '',
        date: entryDate,
        addedBy: userId,
        ...evidence
      });
    } else if (section === 'followup') {
      const VISIT_FIELDS = ['associationToExternal', 'externalToAssociation', 'websiteVisits'];
      const visitType = VISIT_FIELDS.includes(req.body.visitType) ? req.body.visitType : null;
      const visitCount = Number(req.body.visitCount) || 0;
      if (!visitType || visitCount <= 0) {
        return res.redirect(`/employee?section=${section}`);
      }
      const evidence = await buildEvidence(req, section);
      if (evidence._error) return res.redirect(`/employee?section=${section}&uploadError=${evidence._error}`);
      const doc = {
        associationToExternal: 0,
        externalToAssociation: 0,
        websiteVisits: 0,
        date: entryDate,
        addedBy: userId,
        ...evidence
      };
      doc[visitType] = visitCount;
      await Visit.create(doc);
    }

    const io = req.app.get('io');
    io.emit('data:updated', { department: section });

    res.redirect(`/employee?section=${section}&success=1`);
  } catch (err) { next(err); }
});

module.exports = router;
