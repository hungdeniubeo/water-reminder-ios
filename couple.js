import { PUSH_API_URL } from './push-config.js';

const SESSION_KEY = 'water-couple-session-v2';
const API = PUSH_API_URL.trim().replace(/\/$/, '');

export function backendConfigured() { return /^https:\/\/[^/]+$/i.test(API); }
export function getSession() {
  try {
    const data = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return data && typeof data.id === 'string' && typeof data.secret === 'string' ? data : null;
  } catch { return null; }
}
function setSession(data) {
  if (!data?.id || !data?.secret) throw new Error('Invalid device credentials');
  const session = { id: data.id, secret: data.secret };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  if (!backendConfigured()) throw new Error('Backend is not configured');
  const token = getSession();
  if (auth && !token) throw new Error('Not paired');
  const res = await fetch(API + '/api/' + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth ? { Authorization: 'Bearer ' + token.id + '.' + token.secret } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed (' + res.status + ')');
    error.status = res.status;
    throw error;
  }
  return data;
}

export const getPublicConfig = () => request('config', { auth: false });
export const getCouple = () => request('pair/me');
export const createCouple = async (setupKey, profile) => {
  const data = await request('pair/create', { method: 'POST', auth: false, headers: { 'X-Setup-Key': setupKey }, body: profile });
  setSession(data.device);
  return data;
};
export const joinCouple = async (code, profile) => {
  const data = await request('pair/join', { method: 'POST', auth: false, body: { code, ...profile } });
  setSession(data.device);
  return data;
};
export const renewInvite = () => request('pair/invite', { method: 'POST', body: {} });
export const leaveCouple = async () => { await request('pair/leave', { method: 'POST', body: {} }); clearSession(); };
export const updateProfile = profile => request('device/profile', { method: 'POST', body: profile });
export const updateSchedule = schedule => request('device/schedule', { method: 'POST', body: schedule });
export const updateProgress = progress => request('device/progress', { method: 'POST', body: progress });
export const registerSubscription = subscription => request('device/subscribe', { method: 'POST', body: { subscription } });
export const unregisterSubscription = () => request('device/unsubscribe', { method: 'POST', body: {} });
export const requestTestPush = () => request('device/test-push', { method: 'POST', body: {} });