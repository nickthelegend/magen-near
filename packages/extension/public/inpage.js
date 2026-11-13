// window.magen: the page-side API a NEAR dApp calls. Requests go to the Magen extension, which asks the user.
(() => {
  if (window.magen) return;
  let n = 0;
  const waiting = new Map();
  window.addEventListener('message', e => {
    const d = e.data;
    if (e.source !== window || !d || d.source !== 'magen-content' || !waiting.has(d.id)) return;
    const { resolve, reject } = waiting.get(d.id); waiting.delete(d.id);
    d.error ? reject(new Error(d.error)) : resolve(d.result);
  });
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = `${Date.now()}-${++n}`;
    waiting.set(id, { resolve, reject });
    window.postMessage({ source: 'magen-inpage', id, method, params }, location.origin);
  });
  const magen = Object.freeze({
    isMagen: true, version: '0.1.0', network: 'testnet',
    /** Ask the user to share their account. Resolves { accountId }. */
    connect: () => call('connect'),
    /** The connected account for this site, or null. */
    getAccount: () => call('getAccount'),
    /** Forget this site's connection. */
    disconnect: () => call('disconnect'),
    /**
     * wallet-selector style: { receiverId, actions: [{ type: 'Transfer', params: { deposit } }
     *   | { type: 'FunctionCall', params: { methodName, args, gas, deposit } }] }.
     * Magen signs it twice (ed25519 + ML-DSA-65); the wallet contract verifies both on chain.
     * Resolves { transactionHash, success, error }.
     */
    signAndSendTransaction: tx => call('signAndSendTransaction', tx),
  });
  Object.defineProperty(window, 'magen', { value: magen, writable: false });
  window.dispatchEvent(new Event('magen#initialized'));
})();
