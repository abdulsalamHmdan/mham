const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { getDisqRevenueAmount } = require('../services/disqRevenue');

router.use(requireLogin);

router.get('/me', (req, res) => res.json(req.session.user));

router.get('/disq-revenue', async (req, res, next) => {
  try {
    res.json({ source: 'disq', amount: await getDisqRevenueAmount() });
  } catch (err) { next(err); }
});

module.exports = router;
