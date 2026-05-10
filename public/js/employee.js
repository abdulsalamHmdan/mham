(function () {
  const alert = document.querySelector('.alert-success');
  if (alert) {
    setTimeout(() => {
      alert.style.transition = 'opacity 400ms, transform 400ms';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-6px)';
      setTimeout(() => alert.remove(), 420);
    }, 3500);
  }

  const select = document.querySelector('[data-evidence-type]');
  if (select) {
    const panes = document.querySelectorAll('[data-evidence-pane]');
    const update = () => {
      panes.forEach(p => {
        const match = p.getAttribute('data-evidence-pane') === select.value;
        p.style.display = match ? '' : 'none';
        p.querySelectorAll('input, textarea').forEach(el => {
          el.disabled = !match;
        });
      });
    };
    select.addEventListener('change', update);
    update();
  }
})();
