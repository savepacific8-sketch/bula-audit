import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID || "6a03ce3fb5050c56b5224153",
});

// Token helpers — thin wrappers so the rest of the codebase keeps compiling
export function getToken() {
  try { return localStorage.getItem('base44_token'); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem('base44_token', token); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem('base44_token'); } catch { /* ignore */ }
}
export function getRefreshToken() {
  try { return localStorage.getItem('base44_refresh_token'); } catch { return null; }
}
export function setRefreshToken(token) {
  try { localStorage.setItem('base44_refresh_token', token); } catch { /* ignore */ }
}
export function clearRefreshToken() {
  try { localStorage.removeItem('base44_refresh_token'); } catch { /* ignore */ }
}
export function clearAllTokens() {
  clearToken();
  clearRefreshToken();
}