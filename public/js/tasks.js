(function () {
  // -------- Notify task owner --------
  const notifyModal = document.getElementById('taskNotifyModal');
  if (notifyModal) {
    const form     = notifyModal.querySelector('#taskNotifyForm');
    const target   = notifyModal.querySelector('#taskNotifyTarget');
    const submit   = notifyModal.querySelector('#taskNotifySubmit');
    const statusEl = notifyModal.querySelector('#taskNotifyStatus');
    let currentTaskId = null;

    function openNotifyModal(btn) {
      currentTaskId = btn.dataset.notify;
      const ownerName = btn.dataset.ownerName || '';
      const taskTitle = btn.dataset.taskTitle || '';
      target.innerHTML = 'إلى: <strong>' + escapeHtml(ownerName) + '</strong> — بخصوص: <strong>' + escapeHtml(taskTitle) + '</strong>';
      form.reset();
      statusEl.hidden = true;
      statusEl.textContent = '';
      notifyModal.hidden = false;
      const firstInput = form.querySelector('input[name="title"]');
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    }

    function closeNotifyModal() {
      notifyModal.hidden = true;
      currentTaskId = null;
    }

    document.querySelectorAll('[data-notify]').forEach((btn) => {
      btn.addEventListener('click', () => openNotifyModal(btn));
    });

    notifyModal.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', closeNotifyModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !notifyModal.hidden) closeNotifyModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTaskId) return;
      const fd = new FormData(form);
      const title = (fd.get('title') || '').toString().trim();
      const body  = (fd.get('body')  || '').toString().trim();
      if (!title) return;

      submit.disabled = true;
      statusEl.hidden = false;
      statusEl.className = 'form-status muted';
      statusEl.textContent = 'جاري الإرسال...';
      try {
        const res = await fetch('/tasks/' + currentTaskId + '/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
          body: JSON.stringify({ title, body })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'failed');
        statusEl.className = 'form-status form-status-ok';
        statusEl.textContent = '✓ تم إرسال الإشعار';
        setTimeout(closeNotifyModal, 900);
      } catch (err) {
        statusEl.className = 'form-status form-status-err';
        statusEl.textContent = 'تعذّر الإرسال. حاول مرة أخرى.';
      } finally {
        submit.disabled = false;
      }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // -------- Toggle task status (owner only) --------
  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.task-item');
      if (!item) return;
      const id = item.dataset.id;
      const wasDone = item.classList.contains('is-done');

      // Optimistic UI
      item.classList.toggle('is-done');

      try {
        const res = await fetch('/tasks/' + id + '/toggle', { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
        if (!res.ok) throw new Error();
        const data = await res.json();

        // Update meta line
        const meta = item.querySelector('.task-meta');
        if (meta) {
          const due = meta.querySelector('.task-due');
          meta.innerHTML = '';
          if (due) meta.appendChild(due);
          const span = document.createElement('span');
          if (data.status === 'done') {
            span.className = 'task-done-at';
            span.textContent = 'أُتمت ' + new Date(data.completedAt).toLocaleString('ar-SA');
          } else {
            const dueDate = due ? new Date(due.textContent.trim()) : null;
            const isLate = dueDate && dueDate < new Date(new Date().setHours(0,0,0,0));
            span.className = isLate ? 'task-late' : 'task-pending';
            span.textContent = isLate ? 'متأخرة' : 'قيد التنفيذ';
          }
          meta.appendChild(span);
        }
      } catch (e) {
        // rollback
        item.classList.toggle('is-done', wasDone);
      }
    });
  });
})();
