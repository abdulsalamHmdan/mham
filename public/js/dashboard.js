(function () {
  const stats = window.__INITIAL_STATS__ || {};
  let revenueChart, visitsChart;

  const arNum = (n) => Number(n || 0).toLocaleString('ar-SA');

  function setStat(key, value) {
    document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => {
      if (key === 'tasks.progress') {
        el.style.width = value + '%';
        el.textContent = value + '%';
      } else {
        animateNumber(el, value);
      }
    });
  }

  function animateNumber(el, target) {
    const current = Number((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
    const diff = target - current;
    if (diff === 0) { el.textContent = arNum(target); return; }
    const start = performance.now();
    const dur = 600;
    function step(t) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(current + diff * eased);
      el.textContent = arNum(v);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function applyStats(s) {
    setStat('revenue.total', s.revenue.total);
    setStat('revenue.majorDonors', s.revenue.majorDonors);
    setStat('revenue.donationPlatform', s.revenue.donationPlatform);
    setStat('revenue.donationKiosk', s.revenue.donationKiosk);
    setStat('designs.total', s.designs.total);
    setStat('publications.total', s.publications.total);
    setStat('visits.total', s.visits.total);
    setStat('tasks.total', s.tasks.total);
    setStat('tasks.done', s.tasks.done);
    setStat('tasks.progress', s.tasks.progress);
    updateRevenueChart(s);
    updateVisitsChart(s);
  }

  function buildRevenueChart() {
    const ctx = document.getElementById('revenueDonut');
    if (!ctx) return;
    revenueChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['كبار الداعمين', 'منصة التبرعات', 'كشك التبرعات'],
        datasets: [{
          data: [stats.revenue.majorDonors, stats.revenue.donationPlatform, stats.revenue.donationKiosk],
          backgroundColor: ['#10b981', '#34d399', '#6ee7b7'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            bodyFont: { family: 'Tajawal', size: 13 },
            titleFont: { family: 'Tajawal', size: 13 },
            backgroundColor: '#0f1f3d',
            padding: 10,
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + arNum(ctx.parsed)
            }
          }
        },
        animation: { duration: 700, easing: 'easeOutCubic' }
      }
    });
  }

  function updateRevenueChart(s) {
    if (!revenueChart) return;
    revenueChart.data.datasets[0].data = [s.revenue.majorDonors, s.revenue.donationPlatform, s.revenue.donationKiosk];
    revenueChart.update();
  }

  function buildVisitsChart() {
    const ctx = document.getElementById('visitsBar');
    if (!ctx) return;
    visitsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['من الجمعية', 'للجمعية', 'الموقع'],
        datasets: [{
          data: [stats.visits.associationToExternal, stats.visits.externalToAssociation, stats.visits.websiteVisits],
          backgroundColor: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 56
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            bodyFont: { family: 'Tajawal', size: 13 },
            titleFont: { family: 'Tajawal', size: 13 },
            backgroundColor: '#0f1f3d',
            padding: 10,
            callbacks: { label: (ctx) => ' ' + arNum(ctx.parsed.y) }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } },
          y: { beginAtZero: true, grid: { color: '#eef1f7' }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } }
        },
        animation: { duration: 700, easing: 'easeOutCubic' }
      }
    });
  }

  function updateVisitsChart(s) {
    if (!visitsChart) return;
    visitsChart.data.datasets[0].data = [s.visits.associationToExternal, s.visits.externalToAssociation, s.visits.websiteVisits];
    visitsChart.update();
  }

  /* Progressive Disclosure: KPI cards expand their detail panels */
  function setupExpand() {
    document.querySelectorAll('[data-expand]').forEach((card) => {
      card.addEventListener('click', () => {
        const targetId = card.getAttribute('data-expand');
        const panel = document.getElementById(targetId);
        if (!panel) return;
        const isOpen = panel.classList.toggle('is-open');
        card.classList.toggle('is-active', isOpen);
        if (isOpen) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  /* Period tabs */
  function setupPeriodTabs() {
    document.querySelectorAll('.period-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.period-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const period = tab.dataset.period;
        const url = period === 'all' ? '/dashboard/stats' : '/dashboard/stats?period=' + period;
        try {
          const r = await fetch(url);
          if (r.ok) applyStats(await r.json());
        } catch (e) { /* noop */ }
      });
    });
  }

  /* Realtime refresh */
  function setupSocket() {
    if (typeof io === 'undefined') return;
    const socket = io();
    socket.on('data:updated', async () => {
      const active = document.querySelector('.period-tab.active');
      const period = active ? active.dataset.period : 'all';
      const url = period === 'all' ? '/dashboard/stats' : '/dashboard/stats?period=' + period;
      try {
        const r = await fetch(url);
        if (r.ok) applyStats(await r.json());
      } catch (e) {}
    });
    socket.on('tasks:updated', async () => {
      const active = document.querySelector('.period-tab.active');
      const period = active ? active.dataset.period : 'all';
      const url = period === 'all' ? '/dashboard/stats' : '/dashboard/stats?period=' + period;
      try {
        const r = await fetch(url);
        if (r.ok) applyStats(await r.json());
      } catch (e) {}
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildRevenueChart();
    buildVisitsChart();
    setupExpand();
    setupPeriodTabs();
    setupSocket();
  });
})();
