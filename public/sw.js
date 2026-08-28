self.addEventListener('push', event => {
  let payload = { title: 'TW Ventures', body: 'You have a new update.', url: '/' };
  try { payload = { ...payload, ...event.data.json() }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || 'tw-update',
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => client.url === target);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
