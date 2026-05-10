const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/me', (req, res) => res.json(req.session.user));

module.exports = router;
