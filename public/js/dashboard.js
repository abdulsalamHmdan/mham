(function () {
  let stats = window.__INITIAL_STATS__ || {};
  let revenueChart, visitsChart, publicationsChart, overviewChart;
  const sparkCharts = {};
  let currentReport = 'overview';
  const filterState = {
    revenue: 'all', designs: 'all', publications: 'all', visits: 'all', tasks: 'all', activity: 'all'
  };
  let searchQuery = '';

  const arNum = (n) => Number(n || 0).toLocaleString('ar-SA');
  const dateFmt = (d, opts) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('ar-SA', opts); } catch (e) { return ''; }
  };
  const timeFmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  };
  const escapeHtml = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const escapeAttr = (v) => escapeHtml(v).replace(/`/g, '&#96;');

  /* =========================================================
     Live stat updates with smooth counter
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
    if (key === 'tasks.progress') updateRingGauges(value);
  }

  function animateNumber(el, target) {
    const current = Number((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
    const t = Number(target) || 0;
    const diff = t - current;
    if (diff === 0) { el.textContent = arNum(t); return; }
    const start = performance.now();
    const dur = 700;
    function step(time) {
      const p = Math.min(1, (time - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(current + diff * eased);
      el.textContent = arNum(v);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setListCount(key, value) {
    document.querySelectorAll(`[data-list-count="${key}"]`).forEach((el) => {
      el.textContent = arNum(value);
    });
  }

  function applyStats(s) {
    stats = s;
    window.__INITIAL_STATS__ = s;
    // top-level numbers
    setStat('revenue.total', s.revenue.total);
    setStat('revenue.majorDonors', s.revenue.majorDonors);
    setStat('revenue.donationPlatform', s.revenue.donationPlatform);
    setStat('revenue.donationKiosk', s.revenue.donationKiosk);
    setStat('revenue.grantOrganizations', s.revenue.grantOrganizations);
    setStat('revenue.governmentSupport', s.revenue.governmentSupport);
    setStat('designs.total', s.designs.total);
    setStat('publications.total', s.publications.total);
    setStat('visits.total', s.visits.total);
    setStat('tasks.total', s.tasks.total);
    setStat('tasks.done', s.tasks.done);
    setStat('tasks.progress', s.tasks.progress);
    setStat('activity.count', (s.activity || []).length);
    // counts
    setListCount('revenue', s.revenue.items.length);
    setListCount('designs', s.designs.items.length);
    setListCount('publications', s.publications.items.length);
    setListCount('visits', s.visits.items.length);
    setListCount('tasks', s.tasks.items.length);
    // charts
    updateRevenueChart(s);
    updateVisitsChart(s);
    updatePublicationsChart(s);
    updateOverviewChart(s);
    updateAllSparklines(s);
    // re-render lists
    renderRevenueList();
    renderDesignsList();
    renderPublicationsList();
    renderVisitsList();
    renderTasksList();
    renderActivity();
    // celebrate
    if (s.tasks && s.tasks.progress >= 100 && s.tasks.total > 0) celebrate();
  }

  /* =========================================================
     Pulse strip — switch report views
     ========================================================= */
  function setupPulse() {
    const segs = document.querySelectorAll('.pulse-seg');
    segs.forEach((seg) => {
      seg.addEventListener('click', () => switchReport(seg.dataset.report));
    });
    document.querySelectorAll('[data-jump]').forEach((tile) => {
      tile.addEventListener('click', () => switchReport(tile.dataset.jump));
    });
    requestAnimationFrame(moveIndicator);
    window.addEventListener('resize', () => requestAnimationFrame(moveIndicator));
  }

  function switchReport(name) {
    if (!name) return;
    currentReport = name;
    document.querySelectorAll('.pulse-seg').forEach((s) => {
      s.classList.toggle('active', s.dataset.report === name);
    });
    document.querySelectorAll('.ws-view').forEach((v) => {
      v.classList.toggle('active', v.dataset.view === name);
    });
    moveIndicator();
    // ensure charts that just appeared are sized correctly
    setTimeout(() => {
      [revenueChart, visitsChart, publicationsChart, overviewChart].forEach((c) => c && c.resize && c.resize());
    }, 60);
    // smooth scroll to workspace top
    const ws = document.querySelector('.workspace');
    if (ws && ws.getBoundingClientRect().top < 0) ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function moveIndicator() {
    const indicator = document.querySelector('[data-pulse-indicator]');
    if (!indicator) return;
    const active = document.querySelector('.pulse-seg.active');
    if (!active) return;
    const stripRect = active.parentElement.getBoundingClientRect();
    const segRect = active.getBoundingClientRect();
    const left = segRect.left - stripRect.left;
    const width = segRect.width;
    const color = getComputedStyle(active).getPropertyValue('--ps-c').trim() || '#1c3464';
    indicator.style.cssText = `width:${width}px; left:${left}px; bottom:0; background: linear-gradient(90deg, ${color}, ${color}aa);`;
  }

  /* =========================================================
     Records rendering
     ========================================================= */
  function ic(svgInner) { return `<span class="record-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svgInner}</svg></span>`; }
  const ICONS = {
    revenue: '<path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4h3v-4z"/>',
    publication: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    visit: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
    task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
    design: '<path d="M21 19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2z"/><circle cx="8.5" cy="9.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'
  };
  const REVENUE_LABELS = {
    majorDonors: 'كبار الداعمين',
    donationPlatform: 'ديسق',
    donationKiosk: 'كشك التبرعات',
    grantOrganizations: 'الجهات المانحة',
    governmentSupport: 'الدعم الحكومي'
  };
  const VISIT_LABELS = {
    associationToExternal: 'من الجمعية',
    externalToAssociation: 'للجمعية',
    websiteVisits: 'الموقع'
  };

  function matchSearch(s) {
    if (!searchQuery) return true;
    return String(s || '').toLowerCase().includes(searchQuery);
  }

  function renderRevenueList() {
    const root = document.querySelector('[data-records="revenue"]');
    if (!root) return;
    const items = (stats.revenue?.items || []).filter((r) => {
      const f = filterState.revenue;
      if (f !== 'all' && (!r.breakdown[f] || r.breakdown[f] <= 0)) return false;
      if (!matchSearch([r.note, r.addedBy?.name, r.total, ...Object.values(r.breakdown || {})].join(' '))) return false;
      return true;
    });
    if (!items.length) {
      root.innerHTML = '<div class="records-empty">لا توجد سجلات مطابقة.</div>';
      return;
    }
    root.innerHTML = items.map((r, i) => {
      const dominant = Object.entries(r.breakdown).sort((a, b) => b[1] - a[1])[0];
      const dominantLabel = dominant && dominant[1] > 0 ? REVENUE_LABELS[dominant[0]] : '';
      const pips = Object.entries(r.breakdown)
        .filter(([k, v]) => v > 0)
        .map(([k, v]) => `<span class="pip">${REVENUE_LABELS[k]}: <b>${arNum(v)}</b></span>`)
        .join('');
      return `
        <article class="record record-financial" data-record="revenue" data-index="${i}" tabindex="0">
          ${ic(ICONS.revenue)}
          <div class="record-body">
            <div class="record-title">${dominantLabel || 'إيراد'} ${r.addedBy ? `<span class="pip">${escapeHtml(r.addedBy.name)}</span>` : ''}</div>
            <div class="record-sub">${pips || '<span>لا توجد قيم</span>'}</div>
          </div>
          <div class="record-tail">
            <div class="record-amount">${arNum(r.total)} ر.س</div>
            <div class="record-time">${dateFmt(r.date)}</div>
          </div>
        </article>
      `;
    }).join('');
    // bind clicks
    root.querySelectorAll('[data-record]').forEach((el) => {
      el.addEventListener('click', () => openRevenueDrawer(items[Number(el.dataset.index)]));
    });
  }

  function renderDesignsList() {
    const root = document.querySelector('[data-records="designs"]');
    if (!root) return;
    const items = (stats.designs?.items || []).filter((d) => {
      const f = filterState.designs;
      if (f !== 'all' && (d.mediaType || 'image') !== f) return false;
      if (!matchSearch([d.title, d.note, d.addedBy?.name].join(' '))) return false;
      return true;
    });
    if (!items.length) {
      root.innerHTML = '<div class="records-empty">لا توجد تصاميم مطابقة.</div>';
      return;
    }
    root.innerHTML = items.map((d, i) => {
      const mt = d.mediaType || 'image';
      let preview = '';
      if (d.imagePath) {
        if (mt === 'video') preview = `<video src="${escapeAttr(d.imagePath)}" muted preload="metadata"></video>`;
        else if (mt === 'pdf') preview = `<div class="pdf-tile">📄 PDF<br><small>${escapeHtml(d.title)}</small></div>`;
        else preview = `<img src="${escapeAttr(d.imagePath)}" alt="${escapeAttr(d.title)}" loading="lazy">`;
      } else {
        preview = `<div class="pdf-tile">${escapeHtml(d.title)}</div>`;
      }
      const badge = mt === 'video' ? 'فيديو' : mt === 'pdf' ? 'PDF' : 'صورة';
      return `
        <div class="mosaic-card" data-record="designs" data-index="${i}" tabindex="0">
          ${preview}
          <span class="mosaic-badge">${badge}</span>
          <div class="mosaic-overlay">
            <strong>${escapeHtml(d.title)}</strong>
            <span>${dateFmt(d.date)}${d.addedBy ? ' • ' + escapeHtml(d.addedBy.name) : ''}</span>
          </div>
        </div>
      `;
    }).join('');
    root.querySelectorAll('[data-record]').forEach((el) => {
      el.addEventListener('click', () => openDesignDrawer(items[Number(el.dataset.index)]));
    });
  }

  function renderPublicationsList() {
    const root = document.querySelector('[data-records="publications"]');
    if (!root) return;
    const items = (stats.publications?.items || []).filter((p) => {
      if (!matchSearch([p.platform, p.note, p.addedBy?.name, p.count].join(' '))) return false;
      return true;
    });
    if (!items.length) {
      root.innerHTML = '<div class="records-empty">لا توجد منشورات.</div>';
      return;
    }
    root.innerHTML = items.map((p, i) => `
      <article class="record record-publication" data-record="publications" data-index="${i}" tabindex="0">
        ${ic(ICONS.publication)}
        <div class="record-body">
          <div class="record-title">${p.platform ? escapeHtml(p.platform) : 'منشور'} ${p.addedBy ? `<span class="pip">${escapeHtml(p.addedBy.name)}</span>` : ''}</div>
          <div class="record-sub">
            ${p.note ? `<span class="pip">${escapeHtml(p.note.substring(0, 60))}${p.note.length > 60 ? '…' : ''}</span>` : '<span>—</span>'}
          </div>
        </div>
        <div class="record-tail">
          <div class="record-amount">${arNum(p.count)}</div>
          <div class="record-time">${dateFmt(p.date)}</div>
        </div>
      </article>
    `).join('');
    root.querySelectorAll('[data-record]').forEach((el) => {
      el.addEventListener('click', () => openPublicationDrawer(items[Number(el.dataset.index)]));
    });
  }

  function renderVisitsList() {
    const root = document.querySelector('[data-records="visits"]');
    if (!root) return;
    const items = (stats.visits?.items || []).filter((v) => {
      const f = filterState.visits;
      if (f !== 'all' && (!v.breakdown[f] || v.breakdown[f] <= 0)) return false;
      if (!matchSearch([v.note, v.addedBy?.name, v.total].join(' '))) return false;
      return true;
    });
    if (!items.length) {
      root.innerHTML = '<div class="records-empty">لا توجد زيارات مطابقة.</div>';
      return;
    }
    root.innerHTML = items.map((v, i) => {
      const pips = Object.entries(v.breakdown)
        .filter(([k, val]) => val > 0)
        .map(([k, val]) => `<span class="pip">${VISIT_LABELS[k]}: <b>${arNum(val)}</b></span>`)
        .join('');
      return `
        <article class="record record-visit" data-record="visits" data-index="${i}" tabindex="0">
          ${ic(ICONS.visit)}
          <div class="record-body">
            <div class="record-title">زيارة ${v.addedBy ? `<span class="pip">${escapeHtml(v.addedBy.name)}</span>` : ''}</div>
            <div class="record-sub">${pips || '<span>لا توجد قيم</span>'}</div>
          </div>
          <div class="record-tail">
            <div class="record-amount">${arNum(v.total)}</div>
            <div class="record-time">${dateFmt(v.date)}</div>
          </div>
        </article>
      `;
    }).join('');
    root.querySelectorAll('[data-record]').forEach((el) => {
      el.addEventListener('click', () => openVisitDrawer(items[Number(el.dataset.index)]));
    });
  }

  function renderTasksList() {
    const root = document.querySelector('[data-records="tasks"]');
    if (!root) return;
    const items = (stats.tasks?.items || []).filter((t) => {
      const f = filterState.tasks;
      if (f !== 'all' && t.status !== f) return false;
      if (!matchSearch([t.title, t.description, t.owner?.name].join(' '))) return false;
      return true;
    });
    if (!items.length) {
      root.innerHTML = '<div class="records-empty">لا توجد مهام مطابقة.</div>';
      return;
    }
    root.innerHTML = items.map((t, i) => {
      const statusClass = t.status === 'done' ? 'is-done' : t.status === 'missed' ? 'is-missed' : 'is-pending';
      const statusText = t.status === 'done' ? 'مكتملة' : t.status === 'missed' ? 'متأخرة' : 'قيد التنفيذ';
      return `
        <article class="record record-task ${statusClass}" data-record="tasks" data-index="${i}" tabindex="0">
          ${ic(ICONS.task)}
          <div class="record-body">
            <div class="record-title">${escapeHtml(t.title)} ${t.owner ? `<span class="pip">${escapeHtml(t.owner.name)}</span>` : ''}</div>
            <div class="record-sub">
              <span class="pip">${statusText}</span>
              <span class="pip">المطلوب: <b>${dateFmt(t.dueDate)}</b></span>
              ${t.completedAt ? `<span class="pip">منجزة: <b>${dateFmt(t.completedAt)}</b></span>` : ''}
            </div>
          </div>
          <div class="record-tail">
            <div class="record-amount">${statusText}</div>
            <div class="record-time">${dateFmt(t.dueDate)}</div>
          </div>
        </article>
      `;
    }).join('');
    root.querySelectorAll('[data-record]').forEach((el) => {
      el.addEventListener('click', () => openTaskDrawer(items[Number(el.dataset.index)]));
    });
  }

  function renderActivity() {
    const root = document.querySelector('[data-activity]');
    if (!root) return;
    const items = (stats.activity || []).filter((a) => {
      const f = filterState.activity;
      if (f !== 'all' && a.kind !== f) return false;
      if (!matchSearch([a.title, a.summary, a.note, a.by?.name].join(' '))) return false;
      return true;
    });
    if (!items.length) {
      root.innerHTML = '<div class="records-empty">لا يوجد نشاط مطابق.</div>';
      return;
    }
    const KIND_LABEL = { revenue: 'إيراد', design: 'تصميم', publication: 'منشور', visit: 'زيارة', task: 'مهمة' };
    root.innerHTML = items.map((a, i) => `
      <div class="act-item act-kind-${a.kind}" data-act-index="${i}">
        <div class="act-item-l">
          <div class="act-item-title">
            <span class="badge">${KIND_LABEL[a.kind] || a.kind}</span>
            ${escapeHtml(a.title)}
          </div>
          <div class="act-item-summary">
            <b>${escapeHtml(a.summary || '')}</b>${a.by ? ' — بواسطة ' + escapeHtml(a.by.name) : ''}${a.note ? ' — ' + escapeHtml(a.note.substring(0, 80)) + (a.note.length > 80 ? '…' : '') : ''}
          </div>
        </div>
        <div class="act-item-tail">
          <div>${dateFmt(a.date)}</div>
          <div>${timeFmt(a.date)}</div>
        </div>
      </div>
    `).join('');
    root.querySelectorAll('[data-act-index]').forEach((el) => {
      el.addEventListener('click', () => openActivityDrawer(items[Number(el.dataset.actIndex)]));
    });
  }

  /* =========================================================
     DRAWER
     ========================================================= */
  const drawer = {
    el: null, body: null, title: null, dot: null, backdrop: null
  };

  function setupDrawer() {
    drawer.el = document.querySelector('[data-drawer]');
    drawer.body = document.querySelector('[data-drawer-body]');
    drawer.title = document.querySelector('[data-drawer-title]');
    drawer.dot = document.querySelector('[data-drawer-dot]');
    drawer.backdrop = document.querySelector('[data-drawer-backdrop]');
    document.querySelectorAll('[data-drawer-close]').forEach((b) => b.addEventListener('click', closeDrawer));
    if (drawer.backdrop) drawer.backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  }

  function openDrawer({ title, color, html }) {
    if (!drawer.el) return;
    drawer.title.textContent = title || 'تفاصيل';
    if (drawer.dot) {
      drawer.dot.style.background = color || 'var(--navy-700)';
      drawer.dot.style.boxShadow = `0 0 0 4px ${color ? color + '22' : 'rgba(15,31,61,0.12)'}`;
    }
    drawer.body.style.setProperty('--rc', color || 'var(--navy-700)');
    drawer.body.innerHTML = html;
    drawer.el.classList.add('is-open');
    drawer.el.setAttribute('aria-hidden', 'false');
    drawer.backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!drawer.el) return;
    drawer.el.classList.remove('is-open');
    drawer.el.setAttribute('aria-hidden', 'true');
    drawer.backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function evidenceHtml(ev) {
    if (!ev) return '';
    if (ev.path) {
      const mt = ev.mediaType || (ev.mimetype || '').split('/')[0];
      let preview = '';
      if (mt === 'video' || (ev.mimetype || '').startsWith('video')) {
        preview = `<video src="${escapeAttr(ev.path)}" controls></video>`;
      } else if (mt === 'pdf' || (ev.mimetype || '').includes('pdf')) {
        preview = `<a class="ev-pdf" href="${escapeAttr(ev.path)}" target="_blank" rel="noopener">📄 فتح ملف PDF (${escapeHtml(ev.originalName || '')})</a>`;
      } else {
        preview = `<a href="${escapeAttr(ev.path)}" target="_blank" rel="noopener"><img src="${escapeAttr(ev.path)}" alt=""></a>`;
      }
      return `<div class="detail-block"><h4>الإثبات</h4><div class="detail-evidence">${preview}</div>${ev.text ? `<p class="detail-note" style="margin-top:10px">${escapeHtml(ev.text)}</p>` : ''}</div>`;
    }
    if (ev.text) {
      return `<div class="detail-block"><h4>الإثبات</h4><p class="detail-note">${escapeHtml(ev.text)}</p></div>`;
    }
    return '';
  }

  function metaCells(arr) {
    return `<div class="detail-grid">${arr.map(([label, val]) => `<div class="detail-cell"><label>${escapeHtml(label)}</label><span>${val == null || val === '' ? '—' : escapeHtml(val)}</span></div>`).join('')}</div>`;
  }

  function openRevenueDrawer(r) {
    const breakdownRows = Object.entries(r.breakdown).map(([k, v]) => `<div class="detail-cell"><label>${REVENUE_LABELS[k]}</label><span>${arNum(v)}</span></div>`).join('');
    const html = `
      <div class="detail-headline" style="--rc:#10b981">
        <div class="h-num">${arNum(r.total)}</div>
        <div class="h-label">إجمالي الإيراد بالريال السعودي</div>
      </div>
      <div class="detail-block">
        <h4>المعلومات الأساسية</h4>
        ${metaCells([
          ['التاريخ', dateFmt(r.date, { year: 'numeric', month: 'long', day: 'numeric' })],
          ['الموظف', r.addedBy?.name || '—'],
          ['القسم', r.addedBy?.department || '—'],
          ['الوقت', timeFmt(r.date)]
        ])}
      </div>
      <div class="detail-block">
        <h4>توزيع المصادر</h4>
        <div class="detail-grid">${breakdownRows}</div>
      </div>
      ${r.note ? `<div class="detail-block"><h4>ملاحظة</h4><p class="detail-note">${escapeHtml(r.note)}</p></div>` : ''}
      ${evidenceHtml(r.evidence)}
    `;
    openDrawer({ title: 'تفاصيل الإيراد', color: '#10b981', html });
  }

  function openDesignDrawer(d) {
    const mt = d.mediaType || 'image';
    let preview = '';
    if (d.imagePath) {
      if (mt === 'video') preview = `<video src="${escapeAttr(d.imagePath)}" controls></video>`;
      else if (mt === 'pdf') preview = `<a class="ev-pdf" href="${escapeAttr(d.imagePath)}" target="_blank" rel="noopener">📄 فتح ملف PDF</a>`;
      else preview = `<a href="${escapeAttr(d.imagePath)}" target="_blank" rel="noopener"><img src="${escapeAttr(d.imagePath)}" alt="${escapeAttr(d.title)}"></a>`;
    }
    const html = `
      <div class="detail-headline" style="--rc:#f59e0b">
        <div class="h-num">${escapeHtml(d.title)}</div>
        <div class="h-label">${mt === 'video' ? 'فيديو' : mt === 'pdf' ? 'ملف PDF' : 'تصميم بصري'}</div>
      </div>
      ${preview ? `<div class="detail-block"><h4>المعاينة</h4><div class="detail-evidence">${preview}</div></div>` : ''}
      <div class="detail-block">
        <h4>المعلومات</h4>
        ${metaCells([
          ['التاريخ', dateFmt(d.date, { year: 'numeric', month: 'long', day: 'numeric' })],
          ['الموظف', d.addedBy?.name || '—'],
          ['القسم', d.addedBy?.department || '—'],
          ['العدد', arNum(d.count || 1)]
        ])}
      </div>
      ${d.note ? `<div class="detail-block"><h4>ملاحظة</h4><p class="detail-note">${escapeHtml(d.note)}</p></div>` : ''}
    `;
    openDrawer({ title: 'تفاصيل التصميم', color: '#f59e0b', html });
  }

  function openPublicationDrawer(p) {
    const html = `
      <div class="detail-headline" style="--rc:#38bdf8">
        <div class="h-num">${arNum(p.count)}</div>
        <div class="h-label">عدد المنشورات${p.platform ? ' — ' + escapeHtml(p.platform) : ''}</div>
      </div>
      <div class="detail-block">
        <h4>المعلومات</h4>
        ${metaCells([
          ['التاريخ', dateFmt(p.date, { year: 'numeric', month: 'long', day: 'numeric' })],
          ['الموظف', p.addedBy?.name || '—'],
          ['القسم', p.addedBy?.department || '—'],
          ['المنصة', p.platform || '—']
        ])}
      </div>
      ${p.note ? `<div class="detail-block"><h4>ملاحظة</h4><p class="detail-note">${escapeHtml(p.note)}</p></div>` : ''}
      ${evidenceHtml(p.evidence)}
    `;
    openDrawer({ title: 'تفاصيل النشر', color: '#38bdf8', html });
  }

  function openVisitDrawer(v) {
    const breakdownRows = Object.entries(v.breakdown).map(([k, val]) => `<div class="detail-cell"><label>${VISIT_LABELS[k]}</label><span>${arNum(val)}</span></div>`).join('');
    const html = `
      <div class="detail-headline" style="--rc:#8b5cf6">
        <div class="h-num">${arNum(v.total)}</div>
        <div class="h-label">إجمالي الزيارات</div>
      </div>
      <div class="detail-block">
        <h4>المعلومات الأساسية</h4>
        ${metaCells([
          ['التاريخ', dateFmt(v.date, { year: 'numeric', month: 'long', day: 'numeric' })],
          ['الموظف', v.addedBy?.name || '—'],
          ['القسم', v.addedBy?.department || '—'],
          ['الوقت', timeFmt(v.date)]
        ])}
      </div>
      <div class="detail-block">
        <h4>تفصيل الزيارات</h4>
        <div class="detail-grid">${breakdownRows}</div>
      </div>
      ${v.note ? `<div class="detail-block"><h4>ملاحظة</h4><p class="detail-note">${escapeHtml(v.note)}</p></div>` : ''}
      ${evidenceHtml(v.evidence)}
    `;
    openDrawer({ title: 'تفاصيل الزيارة', color: '#8b5cf6', html });
  }

  function openTaskDrawer(t) {
    const statusText = t.status === 'done' ? 'مكتملة ✓' : t.status === 'missed' ? 'متأخرة' : 'قيد التنفيذ';
    const color = t.status === 'done' ? '#10b981' : t.status === 'missed' ? '#ef4444' : '#f59e0b';
    const html = `
      <div class="detail-headline" style="--rc:${color}">
        <div class="h-num" style="font-size:24px">${escapeHtml(t.title)}</div>
        <div class="h-label">الحالة: ${statusText}</div>
      </div>
      <div class="detail-block">
        <h4>المعلومات</h4>
        ${metaCells([
          ['الموظف', t.owner?.name || '—'],
          ['القسم', t.owner?.department || '—'],
          ['تاريخ الاستحقاق', dateFmt(t.dueDate, { year: 'numeric', month: 'long', day: 'numeric' })],
          ['تاريخ الإنجاز', t.completedAt ? dateFmt(t.completedAt, { year: 'numeric', month: 'long', day: 'numeric' }) : '—']
        ])}
      </div>
      ${t.description ? `<div class="detail-block"><h4>الوصف</h4><p class="detail-note">${escapeHtml(t.description)}</p></div>` : ''}
    `;
    openDrawer({ title: 'تفاصيل المهمة', color, html });
  }

  function openActivityDrawer(a) {
    if (!a) return;
    if (a.kind === 'revenue') {
      const r = (stats.revenue.items || []).find((x) => x._id === a.refId);
      if (r) return openRevenueDrawer(r);
    }
    if (a.kind === 'design') {
      const d = (stats.designs.items || []).find((x) => x._id === a.refId);
      if (d) return openDesignDrawer(d);
    }
    if (a.kind === 'publication') {
      const p = (stats.publications.items || []).find((x) => x._id === a.refId);
      if (p) return openPublicationDrawer(p);
    }
    if (a.kind === 'visit') {
      const v = (stats.visits.items || []).find((x) => x._id === a.refId);
      if (v) return openVisitDrawer(v);
    }
    if (a.kind === 'task') {
      const t = (stats.tasks.items || []).find((x) => x._id === a.refId);
      if (t) return openTaskDrawer(t);
    }
  }

  /* =========================================================
     Filters & Search
     ========================================================= */
  function setupFilters() {
    document.querySelectorAll('[data-filter-group]').forEach((group) => {
      const key = group.dataset.filterGroup;
      group.querySelectorAll('.seg-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          group.querySelectorAll('.seg-chip').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          filterState[key] = chip.dataset.filter;
          if (key === 'revenue') renderRevenueList();
          if (key === 'designs') renderDesignsList();
          if (key === 'publications') renderPublicationsList();
          if (key === 'visits') renderVisitsList();
          if (key === 'tasks') renderTasksList();
          if (key === 'activity') renderActivity();
        });
      });
    });
  }

  function setupSearch() {
    const input = document.querySelector('[data-cmd-search]');
    if (!input) return;
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        searchQuery = input.value.trim().toLowerCase();
        renderRevenueList();
        renderDesignsList();
        renderPublicationsList();
        renderVisitsList();
        renderTasksList();
        renderActivity();
      }, 120);
    });
  }

  /* =========================================================
     Charts
     ========================================================= */
  function buildOverviewChart() {
    const ctx = document.getElementById('overviewMixed');
    if (!ctx) return;
    overviewChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['إيرادات', 'تصاميم', 'منشورات', 'زيارات', 'مهام'],
        datasets: [{
          data: [
            stats.revenue?.total || 0,
            stats.designs?.total || 0,
            stats.publications?.total || 0,
            stats.visits?.total || 0,
            stats.tasks?.done || 0
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#38bdf8', '#8b5cf6', '#0ea5e9'],
          borderRadius: 14,
          maxBarThickness: 38
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            backgroundColor: '#0f1f3d',
            bodyFont: { family: 'Tajawal', size: 13 },
            callbacks: { label: (ctx) => ' ' + arNum(ctx.parsed.x) }
          }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(107,117,145,0.10)' }, ticks: { font: { family: 'Tajawal', size: 11 }, color: '#6b7591' } },
          y: { grid: { display: false }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } }
        },
        animation: { duration: 900, easing: 'easeOutCubic' },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  function updateOverviewChart(s) {
    if (!overviewChart) return;
    overviewChart.data.datasets[0].data = [
      s.revenue?.total || 0,
      s.designs?.total || 0,
      s.publications?.total || 0,
      s.visits?.total || 0,
      s.tasks?.done || 0
    ];
    overviewChart.update();
  }

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
            backgroundColor: '#0f1f3d',
            bodyFont: { family: 'Tajawal', size: 13 },
            callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + arNum(ctx.parsed) }
          }
        },
        animation: { duration: 900, easing: 'easeOutCubic' },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  function updateRevenueChart(s) {
    if (!revenueChart) return;
    revenueChart.data.datasets[0].data = [
      s.revenue.majorDonors, s.revenue.donationPlatform, s.revenue.donationKiosk,
      s.revenue.grantOrganizations, s.revenue.governmentSupport
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
          borderRadius: 12, borderSkipped: false, maxBarThickness: 56
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { rtl: true, backgroundColor: '#0f1f3d', bodyFont: { family: 'Tajawal', size: 13 }, callbacks: { label: (ctx) => ' ' + arNum(ctx.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } },
          y: { beginAtZero: true, grid: { color: 'rgba(107,117,145,0.12)' }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } }
        },
        animation: { duration: 900, easing: 'easeOutCubic' },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  function updateVisitsChart(s) {
    if (!visitsChart) return;
    visitsChart.data.datasets[0].data = [s.visits.associationToExternal, s.visits.externalToAssociation, s.visits.websiteVisits];
    visitsChart.update();
  }

  function buildPublicationsChart() {
    const ctx = document.getElementById('publicationsChart');
    if (!ctx) return;
    // group by date (day) within the week
    const byDay = {};
    (stats.publications.items || []).forEach((p) => {
      const d = new Date(p.date);
      const k = d.toLocaleDateString('ar-SA', { weekday: 'short' });
      byDay[k] = (byDay[k] || 0) + (p.count || 0);
    });
    const labels = Object.keys(byDay);
    const data = Object.values(byDay);
    publicationsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.18)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#38bdf8',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false }, tooltip: { rtl: true, backgroundColor: '#0f1f3d', bodyFont: { family: 'Tajawal', size: 13 }, callbacks: { label: (ctx) => ' ' + arNum(ctx.parsed.y) } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } },
          y: { beginAtZero: true, grid: { color: 'rgba(107,117,145,0.10)' }, ticks: { font: { family: 'Tajawal', size: 12 }, color: '#6b7591' } }
        },
        animation: { duration: 900, easing: 'easeOutCubic' },
        responsive: true, maintainAspectRatio: false
      }
    });
  }
  function updatePublicationsChart(s) {
    if (!publicationsChart) return;
    const byDay = {};
    (s.publications.items || []).forEach((p) => {
      const d = new Date(p.date);
      const k = d.toLocaleDateString('ar-SA', { weekday: 'short' });
      byDay[k] = (byDay[k] || 0) + (p.count || 0);
    });
    publicationsChart.data.labels = Object.keys(byDay);
    publicationsChart.data.datasets[0].data = Object.values(byDay);
    publicationsChart.update();
  }

  /* =========================================================
     Sparklines
     ========================================================= */
  function makeSparkSeries(seed, total) {
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
  function hexA(hex, a) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function buildSpark(canvas, color, key) {
    const seedMap = { financial: 3, media: 7, content: 11, visits: 17 };
    const totalMap = {
      financial: stats.revenue?.total || 0, media: stats.designs?.total || 0,
      content: stats.publications?.total || 0, visits: stats.visits?.total || 0
    };
    const data = makeSparkSeries(seedMap[key] || 5, totalMap[key] || 0);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 36);
    grad.addColorStop(0, hexA(color, 0.45));
    grad.addColorStop(1, hexA(color, 0));
    sparkCharts[key] = new Chart(canvas, {
      type: 'line',
      data: { labels: data.map((_, i) => i), datasets: [{ data, borderColor: color, backgroundColor: grad, fill: true, tension: 0.42, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: '#0f1f3d', bodyFont: { family: 'Tajawal', size: 12 }, callbacks: { title: () => '', label: (ctx) => arNum(ctx.parsed.y) } } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        animation: { duration: 800, easing: 'easeOutCubic' },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }
  function setupSparklines() {
    const colors = { financial: '#10b981', media: '#f59e0b', content: '#38bdf8', visits: '#8b5cf6' };
    document.querySelectorAll('[data-spark]').forEach((c) => {
      const k = c.dataset.spark;
      if (colors[k]) buildSpark(c, colors[k], k);
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

  /* =========================================================
     Ring gauges (large + tile)
     ========================================================= */
  function updateRingGauges(progress) {
    const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
    // big ring
    document.querySelectorAll('.ring-fill').forEach((ring) => {
      const r = 52;
      const C = 2 * Math.PI * r;
      ring.style.strokeDasharray = C.toFixed(2);
      ring.style.strokeDashoffset = (C * (1 - clamped / 100)).toFixed(2);
    });
    // tile ring
    document.querySelectorAll('.tile-ring-fill').forEach((ring) => {
      const r = 32;
      const C = 2 * Math.PI * r;
      ring.style.strokeDasharray = C.toFixed(2);
      ring.style.strokeDashoffset = (C * (1 - clamped / 100)).toFixed(2);
    });
  }

  /* =========================================================
     Live clock + greeting + theme + reveal
     ========================================================= */
  function tickClock() {
    const el = document.querySelector('[data-clock]');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function setupClock() { tickClock(); setInterval(tickClock, 1000); }

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

  function setupTheme() {
    const btn = document.querySelector('[data-theme-toggle]');
    const saved = localStorage.getItem('exec-theme');
    if (saved === 'dark') document.body.setAttribute('data-theme', 'dark');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('exec-theme', isDark ? 'light' : 'dark');
      [revenueChart, visitsChart, publicationsChart, overviewChart].forEach((c) => c && c.update && c.update());
    });
  }

  function setupReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.06 });
    els.forEach((el) => io.observe(el));
  }

  /* =========================================================
     Realtime via Socket.io
     ========================================================= */
  function setupSocket() {
    if (typeof io === 'undefined') return;
    const socket = io();
    const refresh = async () => {
      try {
        const r = await fetch('/dashboard/stats');
        if (r.ok) applyStats(await r.json());
      } catch (e) {}
    };
    socket.on('data:updated', refresh);
    socket.on('tasks:updated', refresh);
  }

  /* =========================================================
     Confetti
     ========================================================= */
  let confettiActive = false;
  function celebrate() {
    if (confettiActive) return;
    const c = document.getElementById('confetti-canvas');
    if (!c) return;
    confettiActive = true;
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    const colors = ['#10b981', '#34d399', '#3d63b3', '#8b5cf6', '#f59e0b', '#38bdf8'];
    const N = 140;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5,
        r: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
        vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2
      });
    }
    const start = performance.now();
    function frame(t) {
      const elapsed = t - start;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8); ctx.restore();
      });
      if (elapsed < 3500) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, c.width, c.height); confettiActive = false; }
    }
    requestAnimationFrame(frame);
  }

  /* =========================================================
     Boot
     ========================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupGreeting();
    setupClock();
    setupReveal();
    setupDrawer();
    setupPulse();
    setupFilters();
    setupSearch();

    // Charts
    buildOverviewChart();
    buildRevenueChart();
    buildVisitsChart();
    buildPublicationsChart();
    setupSparklines();

    // initial gauge
    if (stats?.tasks) updateRingGauges(stats.tasks.progress || 0);

    // Initial lists
    renderRevenueList();
    renderDesignsList();
    renderPublicationsList();
    renderVisitsList();
    renderTasksList();
    renderActivity();

    // Realtime
    setupSocket();

    // celebrate on load if 100%
    if (stats?.tasks?.progress >= 100 && stats.tasks.total > 0) setTimeout(celebrate, 500);
  });

  window.addEventListener('resize', () => {
    const c = document.getElementById('confetti-canvas');
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
  });
})();
