export const INTERVALS = [60, 90, 120, 180];

export function randomSecret(bytes = 32) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = ''; for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
}
export function safeCompare(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
export const goodName = value => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 32 && !/[<>\u0000-\u001f]/.test(value);
export const goodNote = value => typeof value === 'string' && value.length <= 150 && !/[\u0000-\u0008\u000e-\u001f]/.test(value);
export function goodSchedule({ enabled, start, end, interval, timezone }) {
  if (typeof enabled !== 'boolean') return false;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return false;
  if (start >= end || !INTERVALS.includes(Number(interval))) return false;
  if (typeof timezone !== 'string' || timezone.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); return true; } catch { return false; }
}
export function localClock(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: p.year + '-' + p.month + '-' + p.day, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export function dueSlot(device, date) {
  if (!device.reminder_enabled || !device.push_json) return null;
  try {
    const { day, minutes: current } = localClock(date, device.timezone);
    const start = minutes(device.start_time);
    const end = minutes(device.end_time);
    const interval = Number(device.interval_minutes);
    if (!INTERVALS.includes(interval) || current < start || current > end || (current - start) % interval !== 0) return null;
    return day + ':' + String(current);
  } catch { return null; }
}
export function validPushSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return false;
  if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 1600) return false;
  let url;
  try { url = new URL(subscription.endpoint); } catch { return false; }
  const host = url.hostname.toLowerCase();
  const allowed = host === 'web.push.apple.com' || host.endsWith('.push.apple.com') ||
    host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com';
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  return typeof subscription.keys?.p256dh === 'string' && subscription.keys.p256dh.length > 40 && subscription.keys.p256dh.length < 140 &&
    typeof subscription.keys?.auth === 'string' && subscription.keys.auth.length > 12 && subscription.keys.auth.length < 80;
}