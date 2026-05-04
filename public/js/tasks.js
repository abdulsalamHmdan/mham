(function () {
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
