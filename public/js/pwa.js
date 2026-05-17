/*
 * PWA navigation shim — fixes iOS Safari standalone-mode link breakouts.
 *
 * On iOS, when a page is added to the home screen, tapping certain <a href>
 * links inside the page can launch a full Safari window instead of staying
 * inside the standalone PWA. We intercept same-origin in-scope clicks and
 * route them via location.assign() so navigation stays in the app shell.
 */
(function () {
  var isIOSStandalone = window.navigator.standalone === true;
  var isStandaloneDisplay = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  var inStandalone = isIOSStandalone || isStandaloneDisplay;

  // Mark <html> so CSS can react (e.g. add safe-area padding when in PWA mode).
  document.documentElement.classList.toggle('is-pwa', inStandalone);
  document.documentElement.classList.toggle('is-ios-pwa', isIOSStandalone);

  if (!inStandalone) return;

  function shouldIntercept(a, href) {
    if (!href) return false;
    if (a.hasAttribute('download')) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    if (a.dataset && a.dataset.external === 'true') return false;
    if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return false;
    // Pure hash on the same page — let the browser scroll.
    if (href.charAt(0) === '#') return false;
    try {
      var url = new URL(href, location.href);
      if (url.origin !== location.origin) return false;        // external host -> Safari is correct
      // Files served from /uploads are downloads/views -> keep external for preview.
      if (/^\/uploads\//i.test(url.pathname)) return false;
      return true;
    } catch (e) { return false; }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!shouldIntercept(a, href)) return;
    e.preventDefault();
    try {
      var url = new URL(href, location.href);
      window.location.assign(url.href);
    } catch (err) {
      window.location.href = href;
    }
  }, true);

  // Force any <form method="GET"|"POST"> with same-origin action to submit in-place.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    if (form.target && form.target !== '' && form.target !== '_self') {
      // Strip target so iOS standalone doesn't break out.
      form.target = '_self';
    }
  }, true);
})();
