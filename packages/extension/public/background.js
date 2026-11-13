// Magen service worker: routes dApp requests to an approval window and returns the answer.
// It never sees keys: signing happens in the approval page after the user unlocks.
const S = chrome.storage.session, L = chrome.storage.local;
const originOf = port => { try { return new URL(port.sender.url).origin; } catch { return 'unknown'; } };

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'magen-dapp') return;
  port.onMessage.addListener(async msg => {
    const origin = originOf(port);
    const { connected = {} } = await L.get('connected');
    try {
      if (msg.method === 'getAccount') return port.postMessage({ result: connected[origin] ? { accountId: connected[origin] } : null });
      if (msg.method === 'disconnect') { delete connected[origin]; await L.set({ connected }); return port.postMessage({ result: true }); }
      if (msg.method === 'connect' && connected[origin]) return port.postMessage({ result: { accountId: connected[origin] } });
      if (msg.method === 'signAndSendTransaction' && !connected[origin]) return port.postMessage({ error: 'Connect to Magen first.' });
      if (!['connect', 'signAndSendTransaction'].includes(msg.method)) return port.postMessage({ error: `Magen does not support ${msg.method}.` });
      const id = crypto.randomUUID();
      await S.set({ [`req-${id}`]: { id, origin, method: msg.method, params: msg.params ?? null, at: Date.now() } });
      const win = await chrome.windows.create({ url: `approve.html#${id}`, type: 'popup', width: 400, height: 660, focused: true });
      const done = async (answer) => {
        chrome.storage.onChanged.removeListener(onChange); chrome.windows.onRemoved.removeListener(onClosed);
        await S.remove([`req-${id}`, `res-${id}`]);
        try { port.postMessage(answer); } catch {}
      };
      const onChange = (changes, area) => { if (area === 'session' && changes[`res-${id}`]?.newValue) done(changes[`res-${id}`].newValue); };
      const onClosed = wid => { if (wid === win.id) setTimeout(async () => { const r = (await S.get(`res-${id}`))[`res-${id}`]; done(r ?? { error: 'The request was closed without an answer.' }); }, 300); };
      chrome.storage.onChanged.addListener(onChange); chrome.windows.onRemoved.addListener(onClosed);
    } catch (e) { port.postMessage({ error: String(e?.message ?? e) }); }
  });
});
