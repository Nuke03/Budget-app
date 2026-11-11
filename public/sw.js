// Service worker delle notifiche. Non mette in cache niente.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.titolo || 'Notifica', {
      body: data.testo || '',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (finestre) => {
      for (const finestra of finestre) {
        if ('focus' in finestra) {
          if ('navigate' in finestra) {
            try {
              await finestra.navigate(url);
            } catch {
              return self.clients.openWindow(url);
            }
          }
          return finestra.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
