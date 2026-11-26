export function initSwUpdate(win, doc, toastId = 'update-toast') {
  const nav = win.navigator;
  if (!nav || !nav.serviceWorker) return;
  nav.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && nav.serviceWorker.controller) {
          const toast = doc.getElementById(toastId);
          if (toast) {
            toast.hidden = false;
            toast.addEventListener('click', () => {
              sw.postMessage('SKIP_WAITING');
              win.location.reload();
            }, { once: true });
          }
        }
      });
    });
  }).catch(() => {});
}
