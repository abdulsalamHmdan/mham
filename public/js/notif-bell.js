(function () {
  const badge = document.querySelector('[data-notif-badge]');
  const toastHost = document.getElementById('notifToasts') || (function () {
    const el = document.createElement('div');
    el.id = 'notifToasts';
    el.className = 'notif-toasts';
    document.body.appendChild(el);
    return el;
  })();

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

  refreshBadge();

  if (window.io) {
    try {
      const socket = io();
      const meta = document.querySelector('meta[name="user-id"]');
      const userId = meta ? meta.content : null;
      if (userId) socket.emit('identify', userId);
      socket.on('notification:new', (n) => {
        showToast(n);
        refreshBadge();
      });
    } catch (e) {}
  }
})();
