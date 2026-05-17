(function () {
  const badge = document.querySelector('[data-notif-badge]');
  const toastHost = document.getElementById('notifToasts') || (function () {
    const el = document.createElement('div');
    el.id = 'notifToasts';
    el.className = 'notif-toasts';
    document.body.appendChild(el);
    return el;
  })();

  // -------- Browser notifications (Web Notifications API) --------
  const supportsBrowserNotif = 'Notification' in window;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  // iOS Safari only supports Web Notifications when the page is installed as a PWA (Add to Home Screen, iOS 16.4+).
  const iOSNeedsPwa = isIOS && !isStandalone;

  function shouldShowBrowserNotif() {
    return supportsBrowserNotif && Notification.permission === 'granted' && document.visibilityState !== 'visible';
  }

  function requestPermissionFlow() {
    if (!supportsBrowserNotif) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
    // Don't auto-prompt; show a small inline prompt the user can click.
    insertPermissionPrompt();
  }

  function insertPermissionPrompt() {
    if (document.getElementById('notifPermPrompt')) return;
    const bar = document.createElement('div');
    bar.id = 'notifPermPrompt';
    bar.className = 'notif-perm-prompt';
    bar.innerHTML = `
      <span>هل تود تفعيل إشعارات المتصفح لتصلك التنبيهات حتى عند إغلاق الصفحة؟</span>
      <button type="button" class="btn btn-primary btn-sm" data-allow>تفعيل</button>
      <button type="button" class="btn btn-ghost btn-sm" data-dismiss>لاحقاً</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('[data-allow]').addEventListener('click', () => {
      bar.remove();
      window.activateNotifications();
    });
    bar.querySelector('[data-dismiss]').addEventListener('click', () => {
      try { sessionStorage.setItem('notifPermDismissed', '1'); } catch (e) {}
      bar.remove();
    });
  }

  // -------- iOS / generic activation modal --------
  function openActivationModal({ title, html, primary }) {
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
    return wrap;
  }

  // Expose a manual activation entry point for the "تفعيل الإشعارات" button.
  window.activateNotifications = async function activateNotifications() {
    // Case 1: browser doesn't support Notifications at all.
    if (!supportsBrowserNotif) {
      openActivationModal({
        title: 'الإشعارات غير مدعومة',
        html: `<p>متصفحك الحالي لا يدعم إشعارات الويب. سيتم عرض التنبيهات داخل التطبيق فقط أثناء فتحه.</p>`
      });
      return;
    }

    // Case 2: iOS Safari outside PWA — must install to home screen first.
    if (iOSNeedsPwa) {
      openActivationModal({
        title: 'تفعيل الإشعارات على iPhone',
        html: `
          <p>إشعارات iPhone تتطلب تثبيت التطبيق على الشاشة الرئيسية أولاً (iOS 16.4 أو أحدث).</p>
          <ol class="notif-steps">
            <li>افتح هذه الصفحة في تطبيق <strong>Safari</strong>.</li>
            <li>اضغط زر المشاركة <span class="ios-share">⬆︎</span> في الأسفل.</li>
            <li>اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong> (Add to Home Screen).</li>
            <li>افتح التطبيق من أيقونته على الشاشة الرئيسية.</li>
            <li>ارجع إلى صفحة الإشعارات واضغط <strong>«تفعيل الإشعارات»</strong> مرة أخرى.</li>
          </ol>
          <p class="muted">حتى بدون تفعيل إشعارات النظام، ستظهر التنبيهات داخل التطبيق أثناء فتحه.</p>
        `
      });
      return;
    }

    // Case 3: previously denied — guide user to system settings.
    if (Notification.permission === 'denied') {
      openActivationModal({
        title: 'الإشعارات معطّلة',
        html: `
          <p>تم رفض إذن الإشعارات سابقاً. لإعادة التفعيل، فعّلها من إعدادات الموقع في المتصفح:</p>
          <ul class="notif-steps">
            <li><strong>على iPhone:</strong> الإعدادات ← الإشعارات ← اختر التطبيق (بعد تثبيته على الشاشة الرئيسية).</li>
            <li><strong>على المتصفح:</strong> اضغط أيقونة القفل بجانب العنوان ← أذونات الموقع ← الإشعارات: السماح.</li>
          </ul>
        `
      });
      return;
    }

    // Case 4: already granted.
    if (Notification.permission === 'granted') {
      openActivationModal({
        title: 'الإشعارات مفعّلة',
        html: `<p>الإشعارات مفعّلة بالفعل لهذا الجهاز. سيتم إعلامك بالتنبيهات الجديدة.</p>`
      });
      return;
    }

    // Case 5: default — request permission directly (must be user-gesture-initiated).
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        openActivationModal({
          title: 'تم تفعيل الإشعارات',
          html: `<p>ستصلك الإشعارات الجديدة من هذا التطبيق.</p>`
        });
        try {
          new Notification('تم تفعيل الإشعارات', { body: 'سيتم إعلامك عند وصول إشعار جديد.', icon: '/favicon.ico', dir: 'rtl', lang: 'ar' });
        } catch (e) {}
      } else if (res === 'denied') {
        window.activateNotifications();
      }
    } catch (e) {}
  };

  // Status helper for UI buttons elsewhere.
  window.getNotifStatus = function () {
    if (!supportsBrowserNotif) return 'unsupported';
    if (iOSNeedsPwa) return 'ios-needs-pwa';
    return Notification.permission; // 'granted' | 'denied' | 'default'
  };

  function showBrowserNotif(notif) {
    if (!shouldShowBrowserNotif()) return null;
    try {
      const n = new Notification(notif.title || 'إشعار جديد', {
        body: notif.body || '',
        icon: '/favicon.ico',
        tag: notif._id ? String(notif._id) : undefined,
        dir: 'rtl',
        lang: 'ar'
      });
      n.onclick = () => {
        window.focus();
        window.location.href = notif.link || '/notifications';
        n.close();
      };
      return n;
    } catch (e) { return null; }
  }

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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
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

  // Initial load
  refreshBadge();

  // Show permission prompt unless user has dismissed it this session
  try {
    if (!sessionStorage.getItem('notifPermDismissed')) requestPermissionFlow();
  } catch (e) { requestPermissionFlow(); }

  // Live updates via Socket.IO
  if (window.io) {
    try {
      const socket = io();
      const meta = document.querySelector('meta[name="user-id"]');
      const userId = meta ? meta.content : null;
      if (userId) socket.emit('identify', userId);

      socket.on('notification:new', (n) => {
        // In-app toast always
        showToast(n);
        // Browser notification when tab is hidden / blurred
        showBrowserNotif(n);
        refreshBadge();
      });
    } catch (e) {}
  }

  // Refresh badge when tab regains focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshBadge();
  });
})();
