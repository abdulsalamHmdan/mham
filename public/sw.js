/* Service Worker for Web Push notifications */
const SW_VERSION = 'v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try { data = { title: 'إشعار جديد', body: event.data ? event.data.text() : '' }; }
    catch (e2) { data = { title: 'إشعار جديد' }; }
  }

  const title = data.title || 'إشعار جديد';
  const options = {
    body: data.body || '',
    icon: data.icon || '/img/logo.png',
    badge: data.badge || '/img/logo.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { link: data.link || '/notifications', _id: data._id || null },
    dir: 'rtl',
    lang: 'ar',
    requireInteraction: data.type === 'alert'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/notifications';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if (client.navigate) await client.navigate(link);
          return;
        }
      } catch (e) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(link);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe(event.oldSubscription.options);
      await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
        credentials: 'include'
      });
    } catch (e) {}
  })());
});
