const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireLogin } = require('../middleware/auth');
const Achievement = require('../models/Achievement');
const { saveFile, getMediaType } = require('../services/imageStorage');

router.use(requireLogin);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    cb(null, Boolean(getMediaType(file.mimetype)));
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

function handleUpload(req, res, next) {
  upload.single('evidenceFile')(req, res, (err) => {
    if (err) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'tooLarge' : 'badFile';
      return res.redirect('/achievements?flash=' + code);
    }
    next();
  });
}

router.get('/', async (req, res, next) => {
  try {
    const u = req.session.user;
    const canViewAll = u.role === 'executive' || u.isAdmin;
    const filter = canViewAll ? {} : { owner: u.id };

    const achievements = await Achievement.find(filter)
      .populate('owner', 'name department role')
      .sort({ createdAt: -1 })
      .lean();

    res.render('achievements', {
      title: 'المنجزات',
      achievements,
      canViewAll,
      flash: req.query.flash || ''
    });
  } catch (err) { next(err); }
});

router.post('/', handleUpload, async (req, res, next) => {
  try {
    const u = req.session.user;
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    if (!title) return res.redirect('/achievements?flash=missingTitle');

    const doc = {
      title,
      description,
      owner: u.id,
      evidenceType: 'none'
    };

    const evidenceType = req.body.evidenceType;
    if (evidenceType === 'text') {
      const text = (req.body.evidenceText || '').trim();
      if (text) {
        doc.evidenceType = 'text';
        doc.evidenceText = text;
      }
    } else if (evidenceType === 'media') {
      const file = req.file;
      if (!file) return res.redirect('/achievements?flash=noEvidenceFile');
      let saved;
      try { saved = await saveFile(file); }
      catch (e) {
        console.error('R2 achievement upload failed:', e);
        return res.redirect('/achievements?flash=storage');
      }
      doc.evidenceType = 'media';
      doc.evidencePath = saved.url;
      doc.evidenceKey = saved.key;
      doc.evidenceStorage = saved.storage;
      doc.evidenceMediaType = saved.mediaType;
      doc.evidenceMimetype = saved.mimetype;
      doc.evidenceOriginalName = file.originalname;
    }

    await Achievement.create(doc);
    res.redirect('/achievements?flash=created');
  } catch (err) { next(err); }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    const u = req.session.user;
    const filter = u.isAdmin
      ? { _id: req.params.id }
      : { _id: req.params.id, owner: u.id };
    await Achievement.deleteOne(filter);
    res.redirect('/achievements');
  } catch (err) { next(err); }
});

module.exports = router;
