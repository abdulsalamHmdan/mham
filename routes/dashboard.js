const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Design = require('../models/Design');
const Publication = require('../models/Publication');
const Visit = require('../models/Visit');
const Task = require('../models/Task');
const { currentWeekDateFilter, getCurrentWeekRange, formatWeekLabel } = require('../utils/week');
const { getDisqRevenueAmount } = require('../services/disqRevenue');

router.use(requireRole('executive'));

async function gatherStats() {
  const filter = currentWeekDateFilter();

  const [revenues, designs, publications, visits, tasks, disqRevenue] = await Promise.all([
    Revenue.find(filter).lean(),
    Design.find(filter).populate('addedBy', 'name department').sort({ date: -1, createdAt: -1 }).lean(),
    Publication.find(filter).lean(),
    Visit.find(filter).lean(),
    Task.find().lean(),
    getDisqRevenueAmount()
  ]);

  const revenueBreakdown = revenues.reduce((acc, r) => {
    acc.majorDonors += r.majorDonors || 0;
    acc.donationKiosk += r.donationKiosk || 0;
    acc.grantOrganizations += r.grantOrganizations || 0;
    acc.governmentSupport += r.governmentSupport || 0;
    return acc;
  }, { majorDonors: 0, donationPlatform: disqRevenue, donationKiosk: 0, grantOrganizations: 0, governmentSupport: 0 });
  const revenueTotal =
    revenueBreakdown.majorDonors +
    revenueBreakdown.donationPlatform +
    revenueBreakdown.donationKiosk +
    revenueBreakdown.grantOrganizations +
    revenueBreakdown.governmentSupport;

  const designsTotal = designs.reduce((s, d) => s + (d.count || 1), 0);
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
    period: 'week',
    weekLabel: formatWeekLabel(),
    revenue: { total: revenueTotal, ...revenueBreakdown },
    designs: { total: designsTotal, items: designs },
    publications: { total: publicationsTotal },
    visits: { total: visitsTotal, ...visitsBreakdown },
    tasks: { total: tasksTotal, done: tasksDone, progress: tasksProgress }
  };
}

router.get('/', async (req, res, next) => {
  try {
    const stats = await gatherStats();
    res.render('dashboard', {
      title: 'لوحة المدير التنفيذي',
      stats,
      weekLabel: formatWeekLabel(getCurrentWeekRange())
    });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    res.json(await gatherStats());
  } catch (err) { next(err); }
});

module.exports = router;
