const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Design = require('../models/Design');
const Publication = require('../models/Publication');
const Visit = require('../models/Visit');
const Task = require('../models/Task');

router.use(requireRole('executive'));

function periodFilter(period) {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case 'week': start.setDate(now.getDate() - 7); break;
    case 'month': start.setMonth(now.getMonth() - 1); break;
    case 'year': start.setFullYear(now.getFullYear() - 1); break;
    default: return {};
  }
  return { date: { $gte: start } };
}

async function gatherStats(period) {
  const filter = periodFilter(period);

  const [revenues, designs, publications, visits, tasks] = await Promise.all([
    Revenue.find(filter).lean(),
    Design.find(filter).lean(),
    Publication.find(filter).lean(),
    Visit.find(filter).lean(),
    Task.find().lean()
  ]);

  const revenueBreakdown = revenues.reduce((acc, r) => {
    acc.majorDonors += r.majorDonors || 0;
    acc.donationPlatform += r.donationPlatform || 0;
    acc.donationKiosk += r.donationKiosk || 0;
    return acc;
  }, { majorDonors: 0, donationPlatform: 0, donationKiosk: 0 });
  const revenueTotal = revenueBreakdown.majorDonors + revenueBreakdown.donationPlatform + revenueBreakdown.donationKiosk;

  const designsTotal = designs.reduce((s, d) => s + (d.count || 0), 0);
  const publicationsTotal = publications.reduce((s, p) => s + (p.count || 0), 0);

  const visitsBreakdown = visits.reduce((acc, v) => {
    acc.associationToExternal += v.associationToExternal || 0;
    acc.externalToAssociation += v.externalToAssociation || 0;
    acc.websiteVisits += v.websiteVisits || 0;
    return acc;
  }, { associationToExternal: 0, externalToAssociation: 0, websiteVisits: 0 });
  const visitsTotal = visitsBreakdown.associationToExternal + visitsBreakdown.externalToAssociation + visitsBreakdown.websiteVisits;

  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const tasksProgress = tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);

  return {
    period: period || 'all',
    revenue: { total: revenueTotal, ...revenueBreakdown },
    designs: { total: designsTotal },
    publications: { total: publicationsTotal },
    visits: { total: visitsTotal, ...visitsBreakdown },
    tasks: { total: tasksTotal, done: tasksDone, progress: tasksProgress }
  };
}

router.get('/', async (req, res, next) => {
  try {
    const stats = await gatherStats(req.query.period);
    res.render('dashboard', { title: 'لوحة المدير التنفيذي', stats });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    res.json(await gatherStats(req.query.period));
  } catch (err) { next(err); }
});

module.exports = router;
