const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Design = require('../models/Design');
const Publication = require('../models/Publication');
const Visit = require('../models/Visit');
const Task = require('../models/Task');
const { currentWeekDateFilter, getCurrentWeekRange, formatWeekLabel } = require('../utils/week');

router.use(requireRole('executive'));

function pickEvidence(doc) {
  if (!doc) return null;
  const hasFile = !!doc.evidencePath;
  const hasText = !!(doc.evidenceText && doc.evidenceText.trim());
  if (!hasFile && !hasText && !doc.evidenceType) return null;
  return {
    type: doc.evidenceType || (hasFile ? 'file' : 'text'),
    text: doc.evidenceText || '',
    path: doc.evidencePath || '',
    mediaType: doc.evidenceMediaType || '',
    mimetype: doc.evidenceMimetype || '',
    originalName: doc.evidenceOriginalName || ''
  };
}

async function gatherStats() {
  const filter = currentWeekDateFilter();

  const [revenues, designs, publications, visits, tasks] = await Promise.all([
    Revenue.find(filter).populate('addedBy', 'name department').sort({ date: -1, createdAt: -1 }).lean(),
    Design.find(filter).populate('addedBy', 'name department').sort({ date: -1, createdAt: -1 }).lean(),
    Publication.find(filter).populate('addedBy', 'name department').sort({ date: -1, createdAt: -1 }).lean(),
    Visit.find(filter).populate('addedBy', 'name department').sort({ date: -1, createdAt: -1 }).lean(),
    Task.find().populate('owner', 'name department').sort({ dueDate: 1, createdAt: -1 }).lean()
  ]);

  const revenueBreakdown = revenues.reduce((acc, r) => {
    acc.majorDonors += r.majorDonors || 0;
    acc.donationPlatform += r.donationPlatform || 0;
    acc.donationKiosk += r.donationKiosk || 0;
    acc.grantOrganizations += r.grantOrganizations || 0;
    acc.governmentSupport += r.governmentSupport || 0;
    return acc;
  }, { majorDonors: 0, donationPlatform: 0, donationKiosk: 0, grantOrganizations: 0, governmentSupport: 0 });
  const revenueTotal =
    revenueBreakdown.majorDonors +
    revenueBreakdown.donationPlatform +
    revenueBreakdown.donationKiosk +
    revenueBreakdown.grantOrganizations +
    revenueBreakdown.governmentSupport;

  const revenueItems = revenues.map(r => ({
    _id: String(r._id),
    date: r.date,
    note: r.note || '',
    addedBy: r.addedBy ? { name: r.addedBy.name, department: r.addedBy.department } : null,
    breakdown: {
      majorDonors: r.majorDonors || 0,
      donationPlatform: r.donationPlatform || 0,
      donationKiosk: r.donationKiosk || 0,
      grantOrganizations: r.grantOrganizations || 0,
      governmentSupport: r.governmentSupport || 0
    },
    total:
      (r.majorDonors || 0) + (r.donationPlatform || 0) + (r.donationKiosk || 0) +
      (r.grantOrganizations || 0) + (r.governmentSupport || 0),
    evidence: pickEvidence(r)
  }));

  const designsTotal = designs.reduce((s, d) => s + (d.count || 1), 0);
  const designItems = designs.map(d => ({
    _id: String(d._id),
    title: d.title,
    note: d.note || '',
    date: d.date,
    count: d.count || 1,
    imagePath: d.imagePath || '',
    mediaType: d.mediaType || 'image',
    addedBy: d.addedBy ? { name: d.addedBy.name, department: d.addedBy.department } : null
  }));

  const publicationsTotal = publications.reduce((s, p) => s + (p.count || 0), 0);
  const publicationItems = publications.map(p => ({
    _id: String(p._id),
    count: p.count || 0,
    platform: p.platform || '',
    note: p.note || '',
    date: p.date,
    addedBy: p.addedBy ? { name: p.addedBy.name, department: p.addedBy.department } : null,
    evidence: pickEvidence(p)
  }));

  const visitsBreakdown = visits.reduce((acc, v) => {
    acc.associationToExternal += v.associationToExternal || 0;
    acc.externalToAssociation += v.externalToAssociation || 0;
    acc.websiteVisits += v.websiteVisits || 0;
    return acc;
  }, { associationToExternal: 0, externalToAssociation: 0, websiteVisits: 0 });
  const visitsTotal = visitsBreakdown.associationToExternal + visitsBreakdown.externalToAssociation + visitsBreakdown.websiteVisits;
  const visitItems = visits.map(v => ({
    _id: String(v._id),
    date: v.date,
    note: v.note || '',
    addedBy: v.addedBy ? { name: v.addedBy.name, department: v.addedBy.department } : null,
    breakdown: {
      associationToExternal: v.associationToExternal || 0,
      externalToAssociation: v.externalToAssociation || 0,
      websiteVisits: v.websiteVisits || 0
    },
    total: (v.associationToExternal || 0) + (v.externalToAssociation || 0) + (v.websiteVisits || 0),
    evidence: pickEvidence(v)
  }));

  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const tasksProgress = tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);
  const taskItems = tasks.map(t => ({
    _id: String(t._id),
    title: t.title,
    description: t.description || '',
    status: t.status,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    owner: t.owner ? { name: t.owner.name, department: t.owner.department } : null
  }));

  // Unified activity stream (most recent first)
  const activity = [];
  revenueItems.forEach(r => activity.push({
    kind: 'revenue', date: r.date, refId: r._id, by: r.addedBy,
    title: 'إيراد جديد',
    summary: `${r.total.toLocaleString('ar-SA')} ريال`,
    note: r.note
  }));
  designItems.forEach(d => activity.push({
    kind: 'design', date: d.date, refId: d._id, by: d.addedBy,
    title: 'تصميم جديد',
    summary: d.title,
    note: d.note,
    thumb: d.imagePath, mediaType: d.mediaType
  }));
  publicationItems.forEach(p => activity.push({
    kind: 'publication', date: p.date, refId: p._id, by: p.addedBy,
    title: 'نشر جديد',
    summary: `${p.count} منشور${p.platform ? ' — ' + p.platform : ''}`,
    note: p.note
  }));
  visitItems.forEach(v => activity.push({
    kind: 'visit', date: v.date, refId: v._id, by: v.addedBy,
    title: 'زيارة',
    summary: `${v.total.toLocaleString('ar-SA')} زيارة`,
    note: v.note
  }));
  taskItems.filter(t => t.status === 'done' && t.completedAt).forEach(t => activity.push({
    kind: 'task', date: t.completedAt, refId: t._id, by: t.owner,
    title: 'مهمة مكتملة',
    summary: t.title
  }));
  activity.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    period: 'week',
    weekLabel: formatWeekLabel(),
    revenue: { total: revenueTotal, ...revenueBreakdown, items: revenueItems },
    designs: { total: designsTotal, items: designItems },
    publications: { total: publicationsTotal, items: publicationItems },
    visits: { total: visitsTotal, ...visitsBreakdown, items: visitItems },
    tasks: { total: tasksTotal, done: tasksDone, progress: tasksProgress, items: taskItems },
    activity
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
