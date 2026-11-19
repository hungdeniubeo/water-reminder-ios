/** One iPhone, one private notification subscription. No couple pairing. */
import { PUSH_API_URL } from './push-config.js';

const SESSION_KEY = 'water-beo-device-session-v1';
export const configured = () => /^https:\/\/[^/]+\.workers\.dev\/?$/.test(PUSH_API_URL);

export function session() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return value && typeof value.id === 'string' && typeof value.secret === 'string' ? value : null;
  } catch { return null; }
}
export function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch { /* no storage */ } }

async function request(path, { method = 'GET', payload, activationCode } = {}) {
  if (!configured()) throw new Error('Notification service is not configured');
  const headers = {};
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  const active = session();
  if (active) headers.Authorization = `Bearer ${active.id}.${active.secret}`;
  if (activationCode) headers['X-Setup-Key'] = activationCode;
  let response;
  try {
    response = await fetch(PUSH_API_URL.replace(/\/$/, '') + path, {
      method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
      cache: 'no-store', mode: 'cors'
    });
  } catch { throw new Error('Cannot connect to Cloudflare'); }
  let body = {};
  try { body = await response.json(); } catch { /* no JSON */ }
  if (!response.ok) {
    const err = new Error(body.error || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return body;
}
/** PushManager accepts a Uint8Array reliably across iOS Safari versions. */
export function decodeVapidPublicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid VAPID public key');
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const data = atob(b64);
  return Uint8Array.from(data, c => c.charCodeAt(0));
}
export const publicConfig = () => request('/api/config');
export async function activateDevice(code, locale) {
  const data = await request('/api/activate', { method: 'POST', activationCode: code, payload: { locale } });
  if (!data?.device?.id || !data?.device?.secret) throw new Error('Invalid activation response');
  localStorage.setItem(SESSION_KEY, JSON.stringify(data.device));
  return data;
}
export const getDevice = () => request('/api/device/me');
export const updateSchedule = (schedule) => request('/api/device/schedule', { method: 'POST', payload: schedule });
export const updateMessage = (note) => request('/api/device/message', { method: 'POST', payload: { note } });
export const subscribe = (subscription) => request('/api/device/subscribe', { method: 'POST', payload: { subscription } });
export const unsubscribe = () => request('/api/device/unsubscribe', { method: 'POST', payload: {} });
export const testPush = () => request('/api/device/test-push', { method: 'POST', payload: {} });
export async function disconnect() {
  await request('/api/device/disconnect', { method: 'POST', payload: {} });
  clearSession();
}