// Storage that works in the web app (localStorage, keys only in memory) and in the Chrome extension
// (chrome.storage.local for the encrypted backup, chrome.storage.session for the unlocked session,
// which Chrome keeps in memory and clears when the browser closes).
declare const chrome: any;
export const isExtension = typeof chrome !== 'undefined' && !!chrome?.storage?.local;
const BACKUP = 'magen-backup', SESSION = 'magen-session';

export async function getBackup(): Promise<any> {
  if (isExtension) return (await chrome.storage.local.get(BACKUP))[BACKUP] ?? null;
  try { return JSON.parse(localStorage.getItem(BACKUP) || 'null'); } catch { return null; }
}
export async function setBackup(b: any) {
  if (isExtension) return chrome.storage.local.set({ [BACKUP]: b });
  localStorage.setItem(BACKUP, JSON.stringify(b));
}
export async function getSession(): Promise<any> {
  if (!isExtension) return null;
  return (await chrome.storage.session.get(SESSION))[SESSION] ?? null;
}
export async function setSession(v: any) {
  if (!isExtension) return;
  if (v) await chrome.storage.session.set({ [SESSION]: v }); else await chrome.storage.session.remove(SESSION);
}
