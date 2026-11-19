import { buildPushPayload } from '@block65/webcrypto-web-push';
import { ROOM_ID, PAIR_SECONDS, dueSlot, goodName, goodNote, goodSchedule, localClock, randomPairCode, randomSecret, safeCompare, sha256, validPushSubscription } from './lib.js';

const ALLOWED_ORIGIN = 'https://hungdeniubeo.github.io';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const error = (status, message) => { throw new HttpError(status, message); };
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function cors(response, origin) {
  if (origin === ALLOWED_ORIGIN) {
    const h = new Headers(response.headers);
    h.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Setup-Key');
    h.set('Access-Control-Max-Age', '3600');
    h.set('Vary', 'Origin');
    return new Response(response.body, { status: response.status, headers: h });
  }
  return response;
}
async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 7500) error(413, 'Request too large');
  const text = await request.text();
  if (text.length > 7500) error(413, 'Request too large');
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) error(400, 'Expected JSON object');
    return value;
  } catch (err) { if (err instanceof HttpError) throw err; error(400, 'Invalid JSON'); }
}
function getLanguage(value) { return value === 'en' ? 'en' : 'vi'; }
function trimName(value) { if (!goodName(value)) error(400, 'Name must be 1 to 32 characters'); return value.trim(); }
function nowSeconds() { return Math.floor(Date.now() / 1000); }
async function authenticate(request, env) {
  const match = /^Bearer ([a-f0-9-]{36})\.([a-zA-Z0-9_-]{30,})$/.exec(request.headers.get('authorization') || '');
  if (!match) error(401, 'This phone is not connected');
  const device = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(match[1]).first();
  if (!device || !safeCompare(device.token_hash, await sha256(match[2]))) error(401, 'Session expired; connect again');
  return device;
}
async function inviteCode(env) {
  const code = randomPairCode();
  const expires = nowSeconds() + PAIR_SECONDS;
  await env.DB.prepare('UPDATE rooms SET invite_hash=?, invite_expires=? WHERE id=?').bind(await sha256(code), expires, ROOM_ID).run();
  return { code, expiresAt: expires * 1000 };
}
function publicDevice(row, today) {
  if (!row) return null;
  return { id: row.id, name: row.name, locale: row.lang, pushEnabled: !!row.push_json,
    scheduleEnabled: !!row.reminder_enabled, goal: row.goal, total: row.progress_date === today ? row.progress_total : 0,
    day: row.progress_date === today ? today : null, noteToPartner: row.note_to_partner };
}
async function currentCouple(env, device) {
  const other = await env.DB.prepare('SELECT * FROM devices WHERE room_id=? AND id<>? LIMIT 1').bind(device.room_id, device.id).first();
  const today = localClock(new Date(), device.timezone).day;
  return { self: publicDevice(device, today), partner: publicDevice(other, today), paired: !!other };
}
async function sendPush(env, device, title, body) {
  if (!device.push_json) error(409, 'Enable notifications on this phone first');
  const subscription = JSON.parse(device.push_json);
  const payload = await buildPushPayload({ data: JSON.stringify({ title, body, tag: 'water-reminder', url: '/water-reminder-ios/' }), options: { ttl: 900 } }, subscription, {
    subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY
  });
  const response = await fetch(subscription.endpoint, payload);
  if (response.status === 404 || response.status === 410) {
    await env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=?').bind(device.id).run();
  }
  return response.status;
}
function notificationBody(row, other) {
  const note = other?.note_to_partner?.trim();
  if (note) return note;
  return row.lang === 'en' ? 'Take a little sip, love ♡' : 'Bé ơi, tới giờ uống nước rồi nè ♡';
}
async function route(request, env) {
  if (!env.DB) error(503, 'D1 database is not configured');
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === '/api/config' && method === 'GET') {
    return json({ ready: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.OWNER_SETUP_CODE),
      vapidPublicKey: env.VAPID_PUBLIC_KEY || null });
  }
  if (path === '/api/pair/create' && method === 'POST') {
    if (!env.OWNER_SETUP_CODE || env.OWNER_SETUP_CODE.length < 16) error(503, 'Owner setup code is not configured');
    const key = request.headers.get('X-Setup-Key') || '';
    if (!safeCompare(await sha256(key), await sha256(env.OWNER_SETUP_CODE))) error(403, 'Wrong setup code');
    const b = await readBody(request);
    const name = trimName(b.name);
    const time = nowSeconds();
    const insert = await env.DB.prepare('INSERT OR IGNORE INTO rooms (id,created_at) VALUES (?,?)').bind(ROOM_ID, time).run();
    if (!insert.meta.changes) error(409, 'A private couple room already exists');
    const id = crypto.randomUUID(), secret = randomSecret();
    await env.DB.prepare('INSERT INTO devices (id,room_id,token_hash,name,lang,created_at) VALUES (?,?,?,?,?,?)')
      .bind(id, ROOM_ID, await sha256(secret), name, getLanguage(b.locale), time).run();
    return json({ device: { id, secret }, ...(await inviteCode(env)) }, 201);
  }
  if (path === '/api/pair/join' && method === 'POST') {
    const b = await readBody(request);
    const code = String(b.code || '').trim().toUpperCase().replace(/\s/g, '');
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) error(400, 'Enter the 8-character pairing code');
    const name = trimName(b.name);
    const room = await env.DB.prepare('SELECT * FROM rooms WHERE id=?').bind(ROOM_ID).first();
    if (!room || room.invite_expires < nowSeconds() || !safeCompare(room.invite_hash || '', await sha256(code))) error(403, 'The pairing code is invalid or expired');
    const id = crypto.randomUUID(), secret = randomSecret();
    const result = await env.DB.prepare(`INSERT INTO devices (id,room_id,token_hash,name,lang,created_at)
      SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE room_id=?) < 2`)
      .bind(id, ROOM_ID, await sha256(secret), name, getLanguage(b.locale), nowSeconds(), ROOM_ID).run();
    if (!result.meta.changes) error(409, 'This room already has two phones');
    await env.DB.prepare('UPDATE rooms SET invite_hash=NULL,invite_expires=0 WHERE id=?').bind(ROOM_ID).run();
    return json({ device: { id, secret } }, 201);
  }
  const device = await authenticate(request, env);
  if (path === '/api/pair/me' && method === 'GET') return json(await currentCouple(env, device));
  if (path === '/api/pair/invite' && method === 'POST') {
    const others = await env.DB.prepare('SELECT COUNT(*) AS n FROM devices WHERE room_id=?').bind(ROOM_ID).first();
    if (others.n >= 2) error(409, 'Both phones are connected');
    return json(await inviteCode(env));
  }
  if (path === '/api/pair/leave' && method === 'POST') {
    await env.DB.prepare('DELETE FROM devices WHERE id=?').bind(device.id).run();
    await env.DB.prepare('DELETE FROM rooms WHERE id=? AND NOT EXISTS (SELECT 1 FROM devices WHERE room_id=?)').bind(ROOM_ID, ROOM_ID).run();
    return json({ ok: true });
  }
  if (path === '/api/device/profile' && method === 'POST') {
    const b = await readBody(request);
    const name = trimName(b.name);
    if (!goodNote(b.note)) error(400, 'Message must be under 150 characters');
    await env.DB.prepare('UPDATE devices SET name=?, note_to_partner=?, lang=? WHERE id=?')
      .bind(name, b.note, getLanguage(b.locale), device.id).run();
    return json({ ok: true });
  }
  if (path === '/api/device/schedule' && method === 'POST') {
    const b = await readBody(request);
    if (!goodSchedule(b)) error(400, 'Invalid reminder schedule or timezone');
    await env.DB.prepare('UPDATE devices SET reminder_enabled=?,start_time=?,end_time=?,interval_minutes=?,timezone=?,lang=? WHERE id=?')
      .bind(b.enabled ? 1 : 0, b.start, b.end, Number(b.interval), b.timezone, getLanguage(b.locale), device.id).run();
    return json({ ok: true });
  }
  if (path === '/api/device/progress' && method === 'POST') {
    const b = await readBody(request);
    const actualToday = localClock(new Date(), device.timezone).day;
    if (b.day !== actualToday || !Number.isInteger(b.total) || b.total < 0 || b.total > 25000 || !Number.isInteger(b.goal) || b.goal < 500 || b.goal > 6000) error(400, 'Invalid daily progress');
    await env.DB.prepare('UPDATE devices SET progress_date=?,progress_total=?,goal=? WHERE id=?').bind(b.day, b.total, b.goal, device.id).run();
    return json({ ok: true });
  }
  if (path === '/api/device/subscribe' && method === 'POST') {
    const b = await readBody(request);
    if (!validPushSubscription(b.subscription)) error(400, 'Unsupported or invalid push subscription');
    await env.DB.prepare('UPDATE devices SET push_json=?,push_endpoint=? WHERE id=?')
      .bind(JSON.stringify(b.subscription), b.subscription.endpoint, device.id).run();
    return json({ ok: true });
  }
  if (path === '/api/device/unsubscribe' && method === 'POST') {
    await env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=?').bind(device.id).run();
    return json({ ok: true });
  }
  if (path === '/api/device/test-push' && method === 'POST') {
    if (!device.push_json) error(409, 'Enable notifications first');
    const limit = await env.DB.prepare('UPDATE devices SET last_test_at=? WHERE id=? AND last_test_at<?')
      .bind(nowSeconds(), device.id, nowSeconds() - 120).run();
    if (!limit.meta.changes) error(429, 'Wait 2 minutes before another test');
    const other = await env.DB.prepare('SELECT note_to_partner FROM devices WHERE room_id=? AND id<>? LIMIT 1').bind(ROOM_ID, device.id).first();
    const status = await sendPush(env, device, 'Water ♡', notificationBody(device, other));
    if (status < 200 || status >= 300) error(502, 'Push service rejected the notification (' + status + ')');
    return json({ ok: true });
  }
  error(404, 'Route not found');
}

async function checkAndSendReminders(env, date) {
  if (!env.DB || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const result = await env.DB.prepare('SELECT * FROM devices WHERE reminder_enabled=1 AND push_json IS NOT NULL').all();
  for (const device of result.results || []) {
    const slot = dueSlot(device, date);
    if (!slot || slot === device.last_sent_slot) continue;
    const update = await env.DB.prepare('UPDATE devices SET last_sent_slot=? WHERE id=? AND last_sent_slot<>?')
      .bind(slot, device.id, slot).run();
    if (!update.meta.changes) continue;
    const partner = await env.DB.prepare('SELECT note_to_partner FROM devices WHERE room_id=? AND id<>? LIMIT 1').bind(device.room_id, device.id).first();
    try {
      const status = await sendPush(env, device, 'Water ♡', notificationBody(device, partner));
      if (status < 200 || status >= 300) console.error('Push rejected', device.id, status);
    } catch (err) { console.error('Push failed', device.id, err.message); }
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
    try { return cors(await route(request, env), origin); }
    catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('Unexpected backend error', err);
      return cors(json({ error: status === 500 ? 'Internal server error' : err.message }, status), origin);
    }
  },
  async scheduled(controller, env) {
    await checkAndSendReminders(env, new Date(controller.scheduledTime || Date.now()));
  }
};