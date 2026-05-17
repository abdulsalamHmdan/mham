(function () {
  // -------- Activate-notifications button --------
  const activateBtn = document.getElementById('activateNotifBtn');
  if (activateBtn) {
    function refreshActivateBtn() {
      const label = activateBtn.querySelector('[data-activate-label]');
      const status = (window.getNotifStatus && window.getNotifStatus()) || 'default';
      const labels = {
        'granted':       'الإشعارات مفعّلة ✓',
        'denied':        'الإشعارات معطّلة — اضغط للمساعدة',
        'ios-needs-pwa': 'تفعيل الإشعارات على iPhone',
        'unsupported':   'غير مدعوم في هذا المتصفح',
        'default':       'تفعيل الإشعارات'
      };
      if (label) label.textContent = labels[status] || labels['default'];
      activateBtn.classList.toggle('is-active', status === 'granted');
      activateBtn.classList.toggle('is-disabled', status === 'unsupported');
    }
    refreshActivateBtn();
    activateBtn.addEventListener('click', () => {
      if (window.activateNotifications) window.activateNotifications();
      setTimeout(refreshActivateBtn, 600);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshActivateBtn();
    });
  }

  // -------- Test push button --------
  const testBtn = document.getElementById('testPushBtn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const original = testBtn.innerHTML;
      testBtn.disabled = true;
      testBtn.textContent = 'جاري الإرسال...';
      try {
        const r = await fetch('/push/test', { method: 'POST', credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.ok) {
          testBtn.textContent = `✓ تم — ${d.sent}/${d.subs} جهاز`;
        } else if (d.subs === 0) {
          testBtn.textContent = '⚠ لا يوجد اشتراك — اضغط «تفعيل»';
        } else if (r.status === 503) {
          testBtn.textContent = '⚠ Push غير مهيأ على الخادم';
        } else {
          testBtn.textContent = '✗ فشل: ' + (d.error || r.status);
        }
      } catch (e) {
        testBtn.textContent = '✗ خطأ في الشبكة';
      }
      setTimeout(() => {
        testBtn.innerHTML = original;
        testBtn.disabled = false;
      }, 3500);
    });
  }

  const audience = document.getElementById('audienceSelect');
  const recipientsField = document.getElementById('recipientsField');
  const recipientsList = document.getElementById('recipientsList');
  const loadBtn = document.getElementById('loadRecipients');

  if (audience) {
    audience.addEventListener('change', () => {
      if (!recipientsField) return;
      recipientsField.style.display = audience.value === 'custom' ? '' : 'none';
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/notifications/recipients');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        recipientsList.innerHTML = data.users.map(u => `
          <label class="check">
            <input type="checkbox" name="recipients" value="${u._id}">
            <span>${u.name} <small class="muted">(${u.username})</small></span>
          </label>
        `).join('');
      } catch (e) {
        recipientsList.innerHTML = '<span class="muted">تعذّر تحميل القائمة</span>';
      }
    });
  }

  document.querySelectorAll('[data-mark-read]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.markRead;
      try {
        const res = await fetch(`/notifications/${id}/read`, { method: 'POST' });
        if (res.ok) {
          const item = btn.closest('.notif-item');
          if (item) { item.classList.remove('is-unread'); item.classList.add('is-read'); }
          btn.remove();
          updateBadge();
        }
      } catch (e) {}
    });
  });

  async function updateBadge() {
    try {
      const res = await fetch('/notifications/unread-count');
      if (!res.ok) return;
      const { count } = await res.json();
      const badge = document.querySelector('[data-notif-badge]');
      if (badge) {
        badge.textContent = count > 0 ? count : '';
        badge.style.display = count > 0 ? '' : 'none';
      }
    } catch (e) {}
  }

  // Live updates
  if (window.io) {
    try {
      const socket = io();
      const meta = document.querySelector('meta[name="user-id"]');
      const userId = meta ? meta.content : null;
      if (userId) socket.emit('identify', userId);
      socket.on('notification:new', () => {
        updateBadge();
      });
    } catch (e) {}
  }
})();
