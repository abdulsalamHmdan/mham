(function () {
  const stats = window.__INITIAL_STATS__ || {};
  let revenueChart, visitsChart;
  const sparkCharts = {};

  const arNum = (n) => Number(n || 0).toLocaleString('ar-SA');

  /* =========================================================
     Stat updates with smooth counter animation
     ========================================================= */
  function setStat(key, value) {
    document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => {
      if (key === 'tasks.progress') {
        if (el.classList.contains('progress-bar')) {
          el.style.width = value + '%';
          el.textContent = value + '%';
        } else {
          animateNumber(el, value);
        }
      } else {
        animateNumber(el, value);
      }
    });
    if (key === 'tasks.progress') updateRingGauge(value);
  }

  function animateNumber(el, target) {
    const current = Number((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
    const diff = target - current;
    if (diff === 0) { el.textContent = arNum(target); return; }
    const start = performance.now();
    const dur = 900;
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
    setStat('revenue.grantOrganizations', s.revenue.grantOrganizations);
    setStat('revenue.governmentSupport', s.revenue.governmentSupport);
    setStat('designs.total', s.designs.total);
    renderDesignGallery(s.designs.items || []);
    setStat('publications.total', s.publications.total);
    setStat('visits.total', s.visits.total);
    setStat('tasks.total', s.tasks.total);
    setStat('tasks.done', s.tasks.done);
    setStat('tasks.progress', s.tasks.progress);
    updateRevenueChart(s);
    updateVisitsChart(s);
    updateAllSparklines(s);
    if (s.tasks && s.tasks.progress >= 100 && s.tasks.total > 0) celebrate();
  }

  /* =========================================================
     Revenue donut + visits bar
     ========================================================= */
  function buildRevenueChart() {
    const ctx = document.getElementById('revenueDonut');
    if (!ctx) return;
    revenueChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['كبار الداعمين', 'ديسق', 'كشك التبرعات', 'الجهات المانحة', 'الدعم الحكومي'],
        datasets: [{
          data: [
            stats.revenue.majorDonors,
            stats.revenue.donationPlatform,
            stats.revenue.donationKiosk,
            stats.revenue.grantOrganizations,
            stats.revenue.governmentSupport
          ],
          backgroundColor: ['#10b981', '#34d399', '#6ee7b7', '#22c55e', '#84cc16'],
          borderWidth: 0,
          hoverOffset: 12,
          spacing: 2
        }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            bodyFont: { family: 'Tajawal', size: 13 },
            titleFont: { family: 'Tajawal', size: 13 },
            backgroundColor: '#0f1f3d',
            padding: 10,
            callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + arNum(ctx.parsed) }
          }
        },
        animation: { duration: 900, easing: 'easeOutCubic' }
      }
    });
  }

  function updateRevenueChart(s) {
    if (!revenueChart) return;
    revenueChart.data.datasets[0].data = [
      s.revenue.majorDonors,
      s.revenue.donationPlatform,
      s.revenue.donationKiosk,
      s.revenue.grantOrganizations,
      s.revenue.governmentSupport
    ];
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
          borderRadius: 12,
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
          y: { beginAtZero: true, grid: { color: 'rgba(107,117,145,0.12)' }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } }
        },
        animation: { duration: 900, easing: 'easeOutCubic' }
      }
    });
  }

  function updateVisitsChart(s) {
    if (!visitsChart) return;
    visitsChart.data.datasets[0].data = [s.visits.associationToExternal, s.visits.externalToAssociation, s.visits.websiteVisits];
    visitsChart.update();
  }

  /* =========================================================
     Sparklines inside KPI cards (procedural generation)
     ========================================================= */
  function makeSparkSeries(seed, total) {
    // deterministic-ish playful series scaled to the value
    const base = Math.max(total || 0, 6);
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const wave = Math.sin((i + seed) * 0.7) * 0.35 + Math.sin((i + seed) * 0.23) * 0.2;
      const noise = ((i * 9301 + seed * 49297) % 233280) / 233280;
      const val = Math.max(0, base * (0.55 + wave * 0.4 + noise * 0.25));
      arr.push(Math.round(val));
    }
    arr[arr.length - 1] = total || arr[arr.length - 1];
    return arr;
  }

  function buildSpark(canvas, color) {
    const key = canvas.dataset.spark;
    const seedMap = { financial: 3, media: 7, content: 11, visits: 17 };
    const totalMap = {
      financial: stats.revenue?.total || 0,
      media: stats.designs?.total || 0,
      content: stats.publications?.total || 0,
      visits: stats.visits?.total || 0
    };
    const data = makeSparkSeries(seedMap[key] || 5, totalMap[key] || 0);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 40);
    grad.addColorStop(0, hexA(color, 0.45));
    grad.addColorStop(1, hexA(color, 0));
    sparkCharts[key] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: grad,
          fill: true,
          tension: 0.42,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: '#0f1f3d',
            bodyFont: { family: 'Tajawal', size: 12 },
            padding: 8,
            callbacks: { title: () => '', label: (ctx) => arNum(ctx.parsed.y) }
          }
        },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true }
        },
        animation: { duration: 800, easing: 'easeOutCubic' },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }

  function updateAllSparklines(s) {
    const map = {
      financial: { color: '#10b981', total: s.revenue?.total || 0, seed: 3 },
      media:     { color: '#f59e0b', total: s.designs?.total || 0, seed: 7 },
      content:   { color: '#38bdf8', total: s.publications?.total || 0, seed: 11 },
      visits:    { color: '#8b5cf6', total: s.visits?.total || 0, seed: 17 }
    };
    Object.entries(map).forEach(([k, cfg]) => {
      const ch = sparkCharts[k];
      if (!ch) return;
      ch.data.datasets[0].data = makeSparkSeries(cfg.seed, cfg.total);
      ch.update();
    });
  }

  function hexA(hex, a) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function setupSparklines() {
    const colors = { financial: '#10b981', media: '#f59e0b', content: '#38bdf8', visits: '#8b5cf6' };
    document.querySelectorAll('[data-spark]').forEach((c) => {
      const k = c.dataset.spark;
      if (colors[k]) buildSpark(c, colors[k]);
    });
  }

  /* =========================================================
     Ring gauge (tasks)
     ========================================================= */
  function updateRingGauge(progress) {
    const ring = document.querySelector('.ring-fill');
    if (!ring) return;
    const r = 52;
    const circumference = 2 * Math.PI * r; // ≈ 326.7
    ring.style.strokeDasharray = circumference.toFixed(2);
    const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
    const offset = circumference * (1 - clamped / 100);
    ring.style.strokeDashoffset = offset.toFixed(2);
  }

  /* =========================================================
     Design gallery render
     ========================================================= */
  function renderDesignGallery(items) {
    const gallery = document.querySelector('[data-design-gallery]');
    if (!gallery) return;
    if (!items.length) {
      gallery.innerHTML = '<div class="empty">لا توجد تصاميم هذا الأسبوع.</div>';
      return;
    }
    gallery.innerHTML = '<div class="design-gallery">' + items.map((design) => {
      const title = escapeHtml(design.title || '');
      const note = escapeHtml(design.note || '');
      const date = design.date ? new Date(design.date).toLocaleDateString('ar-SA') : '';
      const employee = design.addedBy && design.addedBy.name ? escapeHtml(design.addedBy.name) : '';
      const image = design.imagePath ? `<img src="${escapeAttribute(design.imagePath)}" alt="${title}">` : '';
      return `
        <article class="design-card">
          ${image}
          <div class="design-card-body">
            <strong>${title}</strong>
            <span>${date}</span>
            ${employee ? `<span>${employee}</span>` : ''}
            ${note ? `<p>${note}</p>` : ''}
          </div>
        </article>
      `;
    }).join('') + '</div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

  /* =========================================================
     Expand panels on KPI click
     ========================================================= */
  function setupExpand() {
    document.querySelectorAll('[data-expand]').forEach((card) => {
      card.addEventListener('click', (e) => {
        // ignore tilt-related drags
        const targetId = card.getAttribute('data-expand');
        const panel = document.getElementById(targetId);
        if (!panel) return;
        const isOpen = panel.classList.toggle('is-open');
        card.classList.toggle('is-active', isOpen);
        if (isOpen) {
          rippleAt(card, e);
          setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
        }
      });
    });
    document.querySelectorAll('[data-close-panel]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-close-panel');
        const panel = document.getElementById(id);
        const card = document.querySelector(`[data-expand="${id}"]`);
        if (panel) panel.classList.remove('is-open');
        if (card) card.classList.remove('is-active');
      });
    });
  }

  function rippleAt(el, e) {
    const rect = el.getBoundingClientRect();
    const x = (e && e.clientX ? e.clientX : rect.left + rect.width / 2) - rect.left;
    const y = (e && e.clientY ? e.clientY : rect.top + rect.height / 2) - rect.top;
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      width:6px; height:6px; border-radius:50%;
      background: currentColor; opacity:0.18;
      transform: translate(-50%, -50%);
      pointer-events:none;
      animation: rippleX 600ms ease-out forwards;
    `;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }

  /* =========================================================
     3D tilt on KPI cards
     ========================================================= */
  function setupTilt() {
    const tiltable = document.querySelectorAll('[data-tilt]');
    if (!tiltable.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    tiltable.forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * 8;
        const ry = (x - 0.5) * 10;
        el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* =========================================================
     Period tabs
     ========================================================= */
  function setupPeriodTabs() {
    document.querySelectorAll('.period-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.period-tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const period = tab.dataset.period;
        const url = period === 'all' ? '/dashboard/stats' : '/dashboard/stats?period=' + period;
        try {
          const r = await fetch(url);
          if (r.ok) applyStats(await r.json());
        } catch (e) { /* noop */ }
      });
    });
  }

  /* =========================================================
     Realtime
     ========================================================= */
  function setupSocket() {
    if (typeof io === 'undefined') return;
    const socket = io();
    const refresh = async () => {
      const active = document.querySelector('.period-tab.active');
      const period = active ? active.dataset.period : 'all';
      const url = period === 'all' ? '/dashboard/stats' : '/dashboard/stats?period=' + period;
      try {
        const r = await fetch(url);
        if (r.ok) applyStats(await r.json());
      } catch (e) {}
    };
    socket.on('data:updated', refresh);
    socket.on('tasks:updated', refresh);
  }

  /* =========================================================
     Live clock + greeting
     ========================================================= */
  function tickClock() {
    const el = document.querySelector('[data-clock]');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function setupClock() {
    tickClock();
    setInterval(tickClock, 1000);
  }
  function setupGreeting() {
    const el = document.querySelector('[data-greet]');
    if (!el) return;
    const h = new Date().getHours();
    let g = 'أهلاً';
    if (h < 5) g = 'مساء الخير';
    else if (h < 12) g = 'صباح الخير';
    else if (h < 18) g = 'مساء النور';
    else g = 'مساء الخير';
    el.textContent = g;
  }

  /* =========================================================
     Theme toggle (persisted)
     ========================================================= */
  function setupTheme() {
    const btn = document.querySelector('[data-theme-toggle]');
    const saved = localStorage.getItem('exec-theme');
    if (saved === 'dark') document.body.setAttribute('data-theme', 'dark');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('exec-theme', isDark ? 'light' : 'dark');
      // refresh chart text colors that rely on tokens
      if (revenueChart) revenueChart.update();
      if (visitsChart) visitsChart.update();
    });
  }

  /* =========================================================
     Scroll reveal
     ========================================================= */
  function setupReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  }

  /* =========================================================
     Confetti (lightweight, no deps)
     ========================================================= */
  let confettiActive = false;
  function celebrate() {
    if (confettiActive) return;
    const c = document.getElementById('confetti-canvas');
    if (!c) return;
    confettiActive = true;
    const ctx = c.getContext('2d');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colors = ['#10b981', '#34d399', '#3d63b3', '#8b5cf6', '#f59e0b', '#38bdf8'];
    const N = 140;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * c.width,
        y: -20 - Math.random() * c.height * 0.5,
        r: 4 + Math.random() * 6,
        c: colors[(Math.random() * colors.length) | 0],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2
      });
    }
    const start = performance.now();
    function frame(t) {
      const elapsed = t - start;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        ctx.restore();
      });
      if (elapsed < 3500) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, c.width, c.height); confettiActive = false; }
    }
    requestAnimationFrame(frame);
  }

  /* =========================================================
     Inject ripple keyframes once
     ========================================================= */
  function injectRippleStyles() {
    if (document.getElementById('exec-ripple-style')) return;
    const s = document.createElement('style');
    s.id = 'exec-ripple-style';
    s.textContent = `@keyframes rippleX { to { width: 320px; height: 320px; opacity: 0; } }`;
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectRippleStyles();
    setupTheme();
    setupGreeting();
    setupClock();
    setupReveal();
    buildRevenueChart();
    buildVisitsChart();
    setupSparklines();
    setupExpand();
    setupTilt();
    setupPeriodTabs();
    setupSocket();
    // initial gauge
    if (stats && stats.tasks) updateRingGauge(stats.tasks.progress || 0);
    // celebrate on first load if already 100%
    if (stats && stats.tasks && stats.tasks.progress >= 100 && stats.tasks.total > 0) {
      setTimeout(celebrate, 500);
    }
  });

  // Re-size confetti on resize
  window.addEventListener('resize', () => {
    const c = document.getElementById('confetti-canvas');
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
  });
})();
