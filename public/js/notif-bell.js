(function () {
  const badge = document.querySelector('[data-notif-badge]');
  const toastHost = document.getElementById('notifToasts') || (function () {
    const el = document.createElement('div');
    el.id = 'notifToasts';
    el.className = 'notif-toasts';
    document.body.appendChild(el);
    return el;
  })();

  // -------- Capability detection --------
  const supportsBrowserNotif = 'Notification' in window;
  const supportsSW = 'serviceWorker' in navigator;
  const supportsPush = 'PushManager' in window;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  // iOS Safari only supports Web Push when installed as a PWA (iOS 16.4+).
  const iOSNeedsPwa = isIOS && !isStandalone;

  function log(...args) { try { console.log('[notif]', ...args); } catch (e) {} }
  function warn(...args) { try { console.warn('[notif]', ...args); } catch (e) {} }

  // -------- Helpers --------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(b);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // -------- Service Worker + Push subscription --------
  let swRegistration = null;
  let vapidPublicKey = null;

  async function getVapidKey() {
    if (vapidPublicKey) return vapidPublicKey;
    try {
      const r = await fetch('/push/public-key');
      const d = await r.json();
      if (d.publicKey) vapidPublicKey = d.publicKey;
      return vapidPublicKey;
    } catch (e) { warn('failed to fetch VAPID key', e); return null; }
  }

  async function registerServiceWorker() {
    if (!supportsSW) return null;
    try {
      // Always register (it's idempotent) so the SW file is fresh.
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // Wait until the SW is active — pushManager.subscribe needs an active SW.
      const reg = await navigator.serviceWorker.ready;
      swRegistration = reg;
      log('SW ready, scope:', reg.scope, 'active:', !!reg.active);
      return reg;
    } catch (e) {
      warn('SW registration failed:', e);
      return null;
    }
  }

  async function subscribePush() {
    if (!supportsSW) return { ok: false, reason: 'no-service-worker' };
    if (!supportsPush) return { ok: false, reason: 'no-pushmanager (iOS غير محدث أو ليس PWA)' };

    const reg = await registerServiceWorker();
    if (!reg) return { ok: false, reason: 'sw-registration-failed' };
    if (!reg.pushManager) return { ok: false, reason: 'no-pushmanager-on-registration' };

    const key = await getVapidKey();
    if (!key) return { ok: false, reason: 'vapid-key-missing (تحقق من .env وأعد تشغيل الخادم)' };

    let sub;
    try {
      sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key)
        });
        log('New push subscription created');
      } else {
        log('Reusing existing push subscription');
      }
    } catch (e) {
      warn('pushManager.subscribe failed:', e.name, e.message);
      return { ok: false, reason: 'pushManager.subscribe: ' + (e.name || 'Error'), error: e.message };
    }

    try {
      const body = sub.toJSON ? sub.toJSON() : sub;
      const r = await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const t = await r.text().catch(()=>'');
        warn('subscribe save failed', r.status, t);
        return { ok: false, reason: 'server-save-' + r.status, error: t };
      }
      log('Subscription saved on server');
      return { ok: true };
    } catch (e) {
      warn('subscribe save error:', e);
      return { ok: false, reason: 'network', error: e.message };
    }
  }

  async function unsubscribePush() {
    if (!supportsSW || !supportsPush) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch('/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint })
      });
    } catch (e) { warn('unsubscribe failed:', e); }
  }

  async function sendTestPush() {
    try {
      const r = await fetch('/push/test', { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, ...d };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // Expose for diagnostics
  window.pushDebug = { register: registerServiceWorker, subscribe: subscribePush, unsubscribe: unsubscribePush, test: sendTestPush };

  // -------- Activation modal --------
  function openActivationModal({ title, html, primary, onPrimary }) {
    const old = document.getElementById('notifActivateModal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'notifActivateModal';
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-card">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-close" type="button" data-close aria-label="إغلاق">×</button>
        </div>
        <div class="notif-activate-body">${html}</div>
        ${primary ? `<div class="form-actions"><button type="button" class="btn btn-primary" data-primary>${escapeHtml(primary)}</button></div>` : ''}
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => wrap.remove()));
    const p = wrap.querySelector('[data-primary]');
    if (p && onPrimary) p.addEventListener('click', () => onPrimary(wrap));
    return wrap;
  }

  // -------- Main activation entry --------
  window.activateNotifications = async function activateNotifications() {
    log('activate called', { supportsBrowserNotif, supportsSW, supportsPush, isIOS, isStandalone, perm: supportsBrowserNotif ? Notification.permission : 'n/a' });

    if (!supportsBrowserNotif) {
      openActivationModal({
        title: 'الإشعارات غير مدعومة',
        html: `<p>متصفحك الحالي لا يدعم إشعارات الويب. حدّث المتصفح أو استخدم متصفحاً آخر.</p>`
      });
      return;
    }

    if (iOSNeedsPwa) {
      openActivationModal({
        title: 'تفعيل الإشعارات على iPhone',
        html: `
          <p>إشعارات iPhone تتطلب تثبيت التطبيق على الشاشة الرئيسية أولاً (iOS 16.4 أو أحدث).</p>
          <ol class="notif-steps">
            <li>افتح هذه الصفحة في تطبيق <strong>Safari</strong> (وليس Chrome).</li>
            <li>اضغط زر المشاركة <span class="ios-share">⬆︎</span> في الأسفل.</li>
            <li>اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
            <li>افتح التطبيق من أيقونته الجديدة على الشاشة الرئيسية.</li>
            <li>ارجع لصفحة الإشعارات واضغط <strong>«تفعيل الإشعارات»</strong>.</li>
          </ol>
          <p class="muted">بدون تثبيت PWA، iOS لا يسمح بتفعيل إشعارات الويب نهائياً.</p>
        `
      });
      return;
    }

    if (Notification.permission === 'denied') {
      openActivationModal({
        title: 'الإشعارات معطّلة',
        html: `
          <p>تم رفض إذن الإشعارات سابقاً. لإعادة التفعيل:</p>
          <ul class="notif-steps">
            <li><strong>على iPhone (PWA):</strong> الإعدادات ← الإشعارات ← ابحث عن «الاتصال» ← فعّل السماح بالإشعارات.</li>
            <li><strong>على المتصفح:</strong> اضغط القفل بجانب العنوان ← أذونات الموقع ← الإشعارات: السماح.</li>
          </ul>
        `
      });
      return;
    }

    // Request permission (must be user-gesture-initiated). On iOS PWA this also unlocks Push.
    let perm = Notification.permission;
    if (perm === 'default') {
      try { perm = await Notification.requestPermission(); }
      catch (e) { warn('requestPermission threw:', e); }
    }

    if (perm !== 'granted') {
      openActivationModal({
        title: 'لم يتم منح الإذن',
        html: `<p>لم تتم الموافقة على الإشعارات. أعد المحاولة لاحقاً.</p>`
      });
      return;
    }

    // Subscribe to Web Push so notifications arrive even when the app is closed.
    const result = await subscribePush();
    if (result.ok) {
      openActivationModal({
        title: 'تم تفعيل الإشعارات ✓',
        html: `<p>ستصلك الإشعارات حتى وإن كان التطبيق مغلقاً.</p><p class="muted">جرّب الزر أدناه للتأكد:</p>`,
        primary: 'إرسال إشعار اختباري',
        onPrimary: async (modal) => {
          const btn = modal.querySelector('[data-primary]');
          btn.disabled = true; btn.textContent = 'جاري الإرسال...';
          const r = await sendTestPush();
          btn.textContent = r.ok ? '✓ تم الإرسال — انتظر بضع ثوانٍ' : ('فشل: ' + (r.error || r.subs === 0 ? 'لا يوجد اشتراك' : ''));
          setTimeout(() => modal.remove(), 1800);
        }
      });
    } else {
      openActivationModal({
        title: 'تعذّر تسجيل اشتراك الإشعارات',
        html: `
          <p>تم منح الإذن، لكن لم نتمكن من تسجيل الاشتراك (${escapeHtml(result.reason || 'unknown')}).</p>
          ${result.error ? `<p class="muted">التفاصيل: ${escapeHtml(result.error)}</p>` : ''}
          <p class="muted">سيتم عرض الإشعارات داخل التطبيق فقط حالياً.</p>
        `
      });
    }
  };

  // -------- Status used by UI buttons --------
  window.getNotifStatus = function () {
    if (!supportsBrowserNotif) return 'unsupported';
    if (iOSNeedsPwa) return 'ios-needs-pwa';
    return Notification.permission; // 'granted' | 'denied' | 'default'
  };

  // -------- In-app toast --------
  function showToast(notif) {
    const el = document.createElement('div');
    el.className = `notif-toast notif-type-${notif.type || 'info'}`;
    el.innerHTML = `
      <div class="notif-toast-title">${escapeHtml(notif.title || '')}</div>
      ${notif.body ? `<div class="notif-toast-body">${escapeHtml(notif.body)}</div>` : ''}
    `;
    toastHost.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 320);
    }, 5000);
    el.addEventListener('click', () => {
      window.location.href = notif.link || '/notifications';
    });
  }

  async function refreshBadge() {
    if (!badge) return;
    try {
      const res = await fetch('/notifications/unread-count');
      if (!res.ok) return;
      const { count } = await res.json();
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? '' : 'none';
    } catch (e) {}
  }

  // Initial badge load
  refreshBadge();

  // Pre-register the service worker silently (does NOT prompt user — just makes the SW ready).
  if (supportsSW) {
    registerServiceWorker().then(reg => {
      // If permission already granted and we don't have a subscription yet, create one silently.
      if (reg && supportsBrowserNotif && Notification.permission === 'granted' && supportsPush) {
        reg.pushManager.getSubscription().then(sub => {
          if (!sub) subscribePush().then(r => log('silent subscribe result:', r));
        }).catch(()=>{});
      }
    });
  }

  // Live updates via Socket.IO (foreground)
  if (window.io) {
    try {
      const socket = io();
      const meta = document.querySelector('meta[name="user-id"]');
      const userId = meta ? meta.content : null;
      socket.on('connect', () => {
        log('socket connected', socket.id);
        if (userId) socket.emit('identify', userId);
      });
      socket.on('connect_error', (e) => warn('socket connect_error:', e.message));

      socket.on('notification:new', (n) => {
        log('received notification:new', n);
        showToast(n);
        refreshBadge();
      });
    } catch (e) { warn('socket setup failed:', e); }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshBadge();
  });
})();
