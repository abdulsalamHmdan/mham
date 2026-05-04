(function () {
  // Auto-hide success alert
  const alert = document.querySelector('.alert-success');
  if (alert) {
    setTimeout(() => {
      alert.style.transition = 'opacity 400ms, transform 400ms';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-6px)';
      setTimeout(() => alert.remove(), 420);
    }, 3500);
  }
})();
