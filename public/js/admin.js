(function () {
  // Tabs
  const tabs = document.querySelectorAll('.admin-tab');
  const panes = document.querySelectorAll('.admin-pane');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    panes.forEach(p => p.classList.remove('is-active'));
    t.classList.add('active');
    const target = document.querySelector(`.admin-pane[data-pane="${t.dataset.tab}"]`);
    if (target) target.classList.add('is-active');
  }));

  // New user role/department toggle
  const newRole = document.getElementById('newRole');
  const newDeptField = document.getElementById('newDeptField');
  function syncNewDept() {
    if (!newRole || !newDeptField) return;
    newDeptField.style.display = newRole.value === 'employee' ? '' : 'none';
  }
  if (newRole) { newRole.addEventListener('change', syncNewDept); syncNewDept(); }

  // Select all/none for owners
  document.querySelectorAll('[data-select-all]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.selectAll;
      document.querySelectorAll(`input[name="${name}"]`).forEach(c => c.checked = true);
    });
  });
  document.querySelectorAll('[data-select-none]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.selectNone;
      document.querySelectorAll(`input[name="${name}"]`).forEach(c => c.checked = false);
    });
  });

  // Edit user modal
  const modal = document.getElementById('editUserModal');
  const form = document.getElementById('editUserForm');
  const editRole = document.getElementById('editRole');
  const editDeptField = document.getElementById('editDeptField');

  function openModal(user) {
    if (!modal || !form) return;
    form.action = `/admin/users/${user.id}`;
    form.querySelector('input[name="name"]').value = user.name;
    form.querySelector('input[name="username"]').value = user.username;
    form.querySelector('select[name="role"]').value = user.role;
    if (user.department) form.querySelector('select[name="department"]').value = user.department;
    form.querySelector('input[name="isAdmin"]').checked = !!user.isAdmin;
    form.querySelector('input[name="active"]').checked = user.active !== false;
    form.querySelector('input[name="password"]').value = '';
    form.querySelectorAll('input[name="permissions"]').forEach(c => {
      c.checked = (user.permissions || []).includes(c.value);
    });
    syncEditDept();
    modal.hidden = false;

    document.getElementById('deleteUserBtn').onclick = () => {
      if (!confirm('حذف هذا الحساب؟')) return;
      const f = document.createElement('form');
      f.method = 'POST';
      f.action = `/admin/users/${user.id}/delete`;
      document.body.appendChild(f);
      f.submit();
    };
  }
  function closeModal() { if (modal) modal.hidden = true; }
  function syncEditDept() {
    if (!editRole || !editDeptField) return;
    editDeptField.style.display = editRole.value === 'employee' ? '' : 'none';
  }
  if (editRole) editRole.addEventListener('change', syncEditDept);

  document.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      try { openModal(JSON.parse(btn.dataset.editUser)); } catch (e) {}
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Grant/revoke all permissions in modal
  const grantAll = form && form.querySelector('[data-grant-all]');
  const revokeAll = form && form.querySelector('[data-revoke-all]');
  if (grantAll) grantAll.addEventListener('click', () => {
    form.querySelectorAll('input[name="permissions"]').forEach(c => c.checked = true);
  });
  if (revokeAll) revokeAll.addEventListener('click', () => {
    form.querySelectorAll('input[name="permissions"]').forEach(c => c.checked = false);
  });

  // Live updates via socket.io if available
  if (window.io) {
    try {
      const socket = io();
      socket.on('tasks:updated', () => { /* could refresh */ });
    } catch (e) {}
  }
})();
