// Bridges window.magen (page) and the Magen service worker. One port per request keeps the worker alive while the user decides.
(() => {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('inpage.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
  window.addEventListener('message', e => {
    const d = e.data;
    if (e.source !== window || !d || d.source !== 'magen-inpage') return;
    const port = chrome.runtime.connect({ name: 'magen-dapp' });
    const reply = msg => { window.postMessage({ source: 'magen-content', id: d.id, ...msg }, location.origin); try { port.disconnect(); } catch {} };
    port.onMessage.addListener(reply);
    port.onDisconnect.addListener(() => { if (chrome.runtime.lastError) reply({ error: 'Magen extension was reloaded. Try again.' }); });
    port.postMessage({ id: d.id, method: d.method, params: d.params });
  });
})();
