import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorker, latestDueSlot, ROOM_ID, ORIGIN } from './worker.js';
import { sha256 } from './lib.js';
import { SQLiteD1 } from './test-support/sqlite-d1.js';

const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const legacySchema = schema.split('-- Notification-first migration')[0];
const migration = await readFile(new URL('./migrations/0002-admin-receiver.sql', import.meta.url), 'utf8');
const routinesMigration = await readFile(new URL('./migrations/0003-extra-reminders.sql', import.meta.url), 'utf8');
const OWNER_SECRET = 'test-only-admin-code-with-32-characters';
const subscription = {
  endpoint: 'https://web.push.apple.com/test-only-device',
  keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) }
};
async function fixture(t, { legacy = false, pushStatus = 201 } = {}) {
  const DB = new SQLiteD1();
  t.after(() => DB.close());
  DB.exec(legacySchema);
  const clock = { ms: Date.UTC(2026, 10, 20, 2, 0) }; // 09:00 in Vietnam.
  const legacyId = crypto.randomUUID();
  const legacySecret = 'L'.repeat(43);
  if (legacy) {
    await DB.prepare('INSERT INTO rooms (id,created_at) VALUES (?,?)').bind(ROOM_ID, 1).run();
    await DB.prepare(`INSERT INTO devices (id,room_id,token_hash,name,reminder_enabled,note_to_partner,push_json,push_endpoint,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(legacyId, ROOM_ID, await sha256(legacySecret), 'Beo cưng', 1,
      'Lời nhắc cũ được giữ lại ♡', JSON.stringify(subscription), subscription.endpoint, 1).run();
  }
  DB.exec(migration);
  DB.exec(routinesMigration);
  const env = { DB, OWNER_SETUP_CODE: OWNER_SECRET, VAPID_PUBLIC_KEY: 'public-test-key',
    VAPID_PRIVATE_KEY: 'private-test-key', VAPID_SUBJECT: 'https://hungdeniubeo.github.io/water-reminder-ios/' };
  const sent = [];
  let deliver = async input => { sent.push(input); return new Response(null, { status: pushStatus }); };
  const worker = createWorker({ now: () => clock.ms, sendPush: input => deliver(input) });
  async function api(path, { method = 'GET', token, data, origin = ORIGIN } = {}) {
    const response = await worker.fetch(new Request(`https://test.invalid${path}`, {
      method, headers: { ...(origin ? { Origin: origin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {})
    }), env);
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function login() {
    const response = await api('/api/admin/login', { method: 'POST', data: { code: OWNER_SECRET } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.token;
  }
  async function pair(admin, replace = false) {
    const issued = await api('/api/admin/pairing', { method: 'POST', token: admin, data: { replace } });
    assert.equal(issued.status, 201, JSON.stringify(issued.body));
    const result = await api('/api/pair', { method: 'POST', data: { code: issued.body.code } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return `${result.body.device.id}.${result.body.device.secret}`;
  }
  async function connect() {
    const admin = await login();
    const device = await pair(admin, legacy);
    const result = await api('/api/device/subscribe', { method: 'POST', token: device, data: { subscription } });
    assert.equal(result.status, 200);
    return { admin, device };
  }
  return { DB, env, clock, worker, sent, api, login, pair, connect,
    legacyToken: `${legacyId}.${legacySecret}`, setDeliver: fn => { deliver = fn; } };
}
const sendData = () => ({ title: 'Dành cho Beo ♡', body: 'Beo ơi, uống một chút nước nha em ♡', requestId: crypto.randomUUID() });

test('migration is additive, idempotent and preserves the active legacy device credential and settings', async t => {
  const f = await fixture(t, { legacy: true });
  const before = await f.DB.prepare('SELECT * FROM devices WHERE room_id=?').bind(ROOM_ID).first();
  f.DB.exec(migration);
  f.DB.exec(migration);
  const after = await f.DB.prepare('SELECT * FROM devices WHERE room_id=?').bind(ROOM_ID).first();
  assert.deepEqual(after, before);
  const me = await f.api('/api/device/me', { token: f.legacyToken });
  assert.equal(me.status, 200);
  assert.equal(me.body.profile.recipientName, 'Beo cưng');
  assert.equal(me.body.pushEnabled, true);
  const admin = await f.login();
  const state = await f.api('/api/admin/state', { token: admin });
  assert.equal(state.body.settings.reminderMessage, 'Lời nhắc cũ được giữ lại ♡');
  assert.equal(state.body.settings.enabled, true);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM devices').first()).n, 1);
});

test('public config exposes readiness/version but no secret or subscriber details', async t => {
  const f = await fixture(t, { legacy: true });
  const result = await f.api('/api/config');
  assert.equal(result.status, 200);
  assert.equal(result.body.apiVersion, 2);
  assert.equal(result.body.ready, true);
  assert.equal(result.body.mode, 'admin-receiver');
  assert.deepEqual(result.body.capabilities.customMinutes,{min:5,max:720});
  assert.equal(result.body.capabilities.history,true);
  assert.equal(result.body.capabilities.disconnect,true);
  const text = JSON.stringify(result.body);
  assert.ok(!text.includes(OWNER_SECRET));
  assert.ok(!text.includes(subscription.endpoint));
  assert.ok(!text.includes('private-test-key'));
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal((await f.api('/api/config', { origin: 'https://attacker.invalid' })).status, 403);
});

test('missing migration is reported as not ready instead of a successful fake activation', async t => {
  const f = await fixture(t);
  f.DB.exec('DROP TABLE beo_settings');
  const config = await f.api('/api/config');
  assert.equal(config.body.ready, false);
  assert.equal(config.body.reason, 'migration-required');
  assert.equal((await f.api('/api/admin/login', { method: 'POST', data: { code: OWNER_SECRET } })).status, 503);
});

test('anonymous and legacy receiver credentials cannot access admin or old setting/send routes', async t => {
  const f = await fixture(t, { legacy: true });
  for (const token of [undefined, f.legacyToken]) {
    assert.equal((await f.api('/api/admin/state', { token })).status, 401);
    assert.equal((await f.api('/api/admin/send', { method: 'POST', token, data: sendData() })).status, 401);
  }
  for (const action of ['message', 'schedule', 'test-push', 'disconnect']) {
    assert.equal((await f.api(`/api/device/${action}`, { method: 'POST', token: f.legacyToken, data: {} })).status, 403);
  }
  assert.equal((await f.api('/api/activate', { method: 'POST', data: {} })).status, 410);
  assert.equal(f.sent.length, 0);
});

test('admin sessions expire, log out and invalidate when the server secret changes', async t => {
  const f = await fixture(t);
  const admin = await f.login();
  assert.equal((await f.api('/api/admin/state', { token: admin })).status, 200);
  assert.equal((await f.api('/api/admin/logout', { method: 'POST', token: admin })).status, 200);
  assert.equal((await f.api('/api/admin/state', { token: admin })).status, 401);
  const second = await f.login();
  f.env.OWNER_SETUP_CODE = 'a-different-long-admin-secret';
  assert.equal((await f.api('/api/admin/state', { token: second })).status, 401);
  f.env.OWNER_SETUP_CODE = OWNER_SECRET;
  f.clock.ms += 12 * 60 * 60 * 1000;
  assert.equal((await f.api('/api/admin/state', { token: second })).status, 401);
});

test('failed admin login and pairing guesses are rate limited', async t => {
  const f = await fixture(t);
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await f.api('/api/admin/login', { method: 'POST', data: { code: 'wrong' } })).status, 401);
  }
  assert.equal((await f.api('/api/admin/login', { method: 'POST', data: { code: OWNER_SECRET } })).status, 429);
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await f.api('/api/pair', { method: 'POST', data: { code: '12345678' } })).status, 409);
  }
  assert.equal((await f.api('/api/pair', { method: 'POST', data: { code: '12345678' } })).status, 429);
  f.clock.ms += 901000;
  assert.ok(await f.login());
});

test('one pairing code has exactly one winner under concurrent redemption', async t => {
  const f = await fixture(t);
  const admin = await f.login();
  const issued = await f.api('/api/admin/pairing', { method: 'POST', token: admin, data: { replace: false } });
  assert.match(issued.body.code, /^\d{8}$/);
  const responses = await Promise.all([0, 1].map(() => f.api('/api/pair', { method: 'POST', data: { code: issued.body.code } })));
  assert.deepEqual(responses.map(result => result.status).sort(), [201, 409]);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM devices WHERE room_id=?').bind(ROOM_ID).first()).n, 1);
  assert.equal((await f.api('/api/pair', { method: 'POST', data: { code: issued.body.code } })).status, 409);
});

test('pairing code expires after ten minutes', async t => {
  const f = await fixture(t);
  const admin = await f.login();
  const issued = await f.api('/api/admin/pairing', { method: 'POST', token: admin, data: { replace: false } });
  assert.equal(issued.body.expiresAt, f.clock.ms / 1000 + 600);
  f.clock.ms += 600000;
  assert.equal((await f.api('/api/pair', { method: 'POST', data: { code: issued.body.code } })).status, 409);
});

test('replacement preserves the existing phone until successful pairing then revokes its device credential', async t => {
  const f = await fixture(t, { legacy: true });
  const admin = await f.login();
  assert.equal((await f.api('/api/admin/pairing', { method: 'POST', token: admin, data: { replace: false } })).status, 409);
  const issued = await f.api('/api/admin/pairing', { method: 'POST', token: admin, data: { replace: true } });
  assert.equal((await f.api('/api/device/me', { token: f.legacyToken })).body.pushEnabled, true);
  const result = await f.api('/api/pair', { method: 'POST', data: { code: issued.body.code } });
  assert.equal(result.status, 201);
  assert.equal((await f.api('/api/device/me', { token: f.legacyToken })).status, 401);
  const newToken = `${result.body.device.id}.${result.body.device.secret}`;
  assert.equal((await f.api('/api/device/me', { token: newToken })).body.pushEnabled, false);
  const subscribed = await f.DB.prepare('SELECT COUNT(*) AS n FROM devices WHERE push_json IS NOT NULL').first();
  assert.equal(subscribed.n, 0);
  assert.equal(f.sent.length, 0);
});

test('admin settings update receiver name/copy and schedule while keeping them out of public config', async t => {
  const f = await fixture(t);
  const { admin, device } = await f.connect();
  const state = await f.api('/api/admin/state', { token: admin });
  const settings = { ...state.body.settings, recipientName: 'Beo bé', appTitle: 'Một chút yêu ♡',
    homeMessage: 'Hôm nay em nhớ nghỉ tay nhé ♡', reminderMessage: 'Lời nhắn tự chỉnh ♡', enabled: true,
    start: '08:30', end: '20:30', interval: 90 };
  assert.equal((await f.api('/api/admin/settings', { method: 'POST', token: admin, data: settings })).status, 200);
  const me = await f.api('/api/device/me', { token: device });
  assert.equal(me.body.profile.recipientName, 'Beo bé');
  assert.equal(me.body.profile.homeMessage, settings.homeMessage);
  assert.equal(me.body.scheduleEnabled, true);
  assert.equal(JSON.stringify((await f.api('/api/config')).body).includes(settings.homeMessage), false);
  assert.equal((await f.api('/api/admin/settings', { method: 'POST', token: admin, data: { ...settings, reminderMessage: 'x'.repeat(151) } })).status, 400);
  assert.equal((await f.api('/api/admin/settings', { method: 'POST', token: admin, data: { ...settings, timezone: 'Fake/Zone' } })).status, 400);
});

test('custom manual title/body are passed exactly, and provider acceptance is not receipt', async t => {
  const f = await fixture(t);
  const { admin, device } = await f.connect();
  const data = { ...sendData(), title: '♡ Beo <3', body: '  Chào Beo\nLời nhắn của anh ♡  ' };
  const result = await f.api('/api/admin/send', { method: 'POST', token: admin, data });
  assert.equal(result.status, 200);
  assert.equal(result.body.message.status, 'accepted');
  assert.equal(result.body.message.receivedAt, null);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].payload.title, data.title);
  assert.equal(f.sent[0].payload.body, data.body);
  assert.equal(f.sent[0].subscription.endpoint, subscription.endpoint);
  assert.equal((await f.api('/api/device/me', { token: device })).body.latestMessage.body, data.body);
  const stateText = JSON.stringify((await f.api('/api/admin/state', { token: admin })).body);
  assert.ok(!stateText.includes(subscription.endpoint));
  assert.ok(!stateText.includes(f.sent[0].payload.receiptToken));
  assert.ok(!stateText.includes(OWNER_SECRET));
});

test('concurrent duplicate sends claim one request; reused id with altered content is rejected', async t => {
  const f = await fixture(t);
  const { admin } = await f.connect();
  const data = sendData();
  const responses = await Promise.all([0, 1].map(() => f.api('/api/admin/send', { method: 'POST', token: admin, data })));
  assert.ok(responses.every(response => [200, 202].includes(response.status)));
  assert.equal(f.sent.length, 1);
  assert.equal(responses[0].body.message.id, responses[1].body.message.id);
  const repeat = await f.api('/api/admin/send', { method: 'POST', token: admin, data });
  assert.equal(repeat.body.message.status, 'accepted');
  assert.equal(f.sent.length, 1);
  const changed = await f.api('/api/admin/send', { method: 'POST', token: admin, data: { ...data, body: 'Khác rồi' } });
  assert.equal(changed.status, 409);
});

test('receipts require the per-message token and keep received/opened distinct', async t => {
  const f = await fixture(t);
  const { admin } = await f.connect();
  await f.api('/api/admin/send', { method: 'POST', token: admin, data: sendData() });
  const payload = f.sent[0].payload;
  assert.equal((await f.api('/api/receipts', { method: 'POST', data: { id: payload.id, token: 'a'.repeat(64), event: 'received' } })).status, 404);
  f.clock.ms += 1000;
  assert.equal((await f.api('/api/receipts', { method: 'POST', data: { id: payload.id, token: payload.receiptToken, event: 'received' } })).status, 200);
  let state = await f.api('/api/admin/state', { token: admin });
  assert.equal(state.body.messages[0].status, 'received');
  assert.equal(state.body.messages[0].openedAt, null);
  const receivedAt = state.body.messages[0].receivedAt;
  f.clock.ms += 1000;
  await f.api('/api/receipts', { method: 'POST', data: { id: payload.id, token: payload.receiptToken, event: 'opened' } });
  await f.api('/api/receipts', { method: 'POST', data: { id: payload.id, token: payload.receiptToken, event: 'received' } });
  state = await f.api('/api/admin/state', { token: admin });
  assert.equal(state.body.messages[0].status, 'opened');
  assert.equal(state.body.messages[0].receivedAt, receivedAt);
  assert.ok(state.body.messages[0].openedAt > receivedAt);
});

test('404/410 clears the expired push subscription and records an actionable failure', async t => {
  for (const status of [404, 410]) {
    const f = await fixture(t, { pushStatus: status });
    const { admin, device } = await f.connect();
    const sent = await f.api('/api/admin/send', { method: 'POST', token: admin, data: sendData() });
    assert.equal(sent.body.ok, false);
    assert.equal(sent.body.message.status, 'failed');
    assert.equal(sent.body.message.retryAt, null);
    assert.match(sent.body.message.error, /hết hạn/);
    assert.equal((await f.api('/api/device/me', { token: device })).body.pushEnabled, false);
  }
});

test('a redirect is a failed delivery, never accepted or retried, and does not remove the subscription', async t => {
  const f = await fixture(t);
  const { admin, device } = await f.connect();
  let attempts = 0;
  f.setDeliver(async () => {
    attempts++;
    return new Response(null, { status: 302, headers: { Location: 'https://redirect.invalid/' } });
  });
  const sent = await f.api('/api/admin/send', { method: 'POST', token: admin, data: sendData() });
  assert.equal(sent.body.ok, false);
  assert.equal(sent.body.message.status, 'failed');
  assert.equal(sent.body.message.acceptedAt, null);
  assert.equal(sent.body.message.retryAt, null);
  assert.match(sent.body.message.error, /302/);
  assert.equal((await f.api('/api/device/me', { token: device })).body.pushEnabled, true);
  f.clock.ms += 60000;
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  assert.equal(attempts, 1);
});

test('an expired response for an old endpoint cannot clear a newly refreshed subscription', async t => {
  const f = await fixture(t);
  const { admin, device } = await f.connect();
  f.setDeliver(async () => {
    const refreshed = { ...subscription, endpoint: 'https://web.push.apple.com/new-test-registration' };
    await f.api('/api/device/subscribe', { method: 'POST', token: device, data: { subscription: refreshed } });
    return new Response(null, { status: 410 });
  });
  await f.api('/api/admin/send', { method: 'POST', token: admin, data: sendData() });
  assert.equal((await f.api('/api/device/me', { token: device })).body.pushEnabled, true);
});

test('transient send failure retries on cron without claiming delivery', async t => {
  const f = await fixture(t, { pushStatus: 503 });
  const { admin } = await f.connect();
  const data = sendData();
  const sent = await f.api('/api/admin/send', { method: 'POST', token: admin, data });
  assert.equal(sent.body.message.status, 'failed');
  assert.equal(sent.body.message.acceptedAt, null);
  assert.equal(sent.body.message.retryAt, f.clock.ms / 1000 + 60);
  let retries = 0;
  f.setDeliver(async input => { retries++; f.sent.push(input); return new Response(null, { status: 201 }); });
  f.clock.ms += 60000;
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  assert.equal(retries, 1);
  const state = await f.api('/api/admin/state', { token: admin });
  assert.equal(state.body.messages[0].status, 'accepted');
  assert.equal(f.sent[0].payload.id, f.sent[1].payload.id);
  assert.equal(f.sent[0].payload.receiptToken, f.sent[1].payload.receiptToken);
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  assert.equal(retries, 1);
});

test('scheduled sends use event time, Vietnam schedule and one stable slot id', async t => {
  const f = await fixture(t, { legacy: true });
  f.clock.ms += 6 * 60 * 60 * 1000; // Invocation wall clock differs from scheduledTime.
  const scheduledTime = Date.UTC(2026, 10, 20, 2, 0);
  await Promise.all([0, 1].map(() => f.worker.scheduled({ scheduledTime }, f.env)));
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].payload.body, 'Lời nhắc cũ được giữ lại ♡');
  await f.worker.scheduled({ scheduledTime: scheduledTime + 60000 }, f.env);
  assert.equal(f.sent.length, 1);
  await f.worker.scheduled({ scheduledTime: scheduledTime + 2 * 60 * 60 * 1000 }, f.env);
  assert.equal(f.sent.length, 2);
  assert.notEqual(f.sent[0].payload.id, f.sent[1].payload.id);
});

test('a failed scheduled slot is retried instead of being consumed before acceptance', async t => {
  const f = await fixture(t, { legacy: true, pushStatus: 503 });
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  let device = await f.DB.prepare('SELECT * FROM devices WHERE room_id=?').bind(ROOM_ID).first();
  assert.equal(device.last_sent_slot, '');
  f.setDeliver(async input => { f.sent.push(input); return new Response(null, { status: 201 }); });
  f.clock.ms += 60000;
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  device = await f.DB.prepare('SELECT * FROM devices WHERE room_id=?').bind(ROOM_ID).first();
  assert.equal(device.last_sent_slot, '2026-11-20:540');
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[0].payload.id, f.sent[1].payload.id);
});

test('catch-up is bounded and respects the configured time window', () => {
  const settings = { schedule_enabled: 1, start_time: '09:00', end_time: '21:00', interval_minutes: 120, timezone: 'Asia/Ho_Chi_Minh' };
  const device = { push_json: '{}' };
  assert.equal(latestDueSlot(settings, device, new Date('2026-11-20T01:59:00Z')), null);
  assert.equal(latestDueSlot(settings, device, new Date('2026-11-20T02:14:00Z')), '2026-11-20:540');
  assert.equal(latestDueSlot(settings, device, new Date('2026-11-20T02:15:00Z')), null);
  assert.equal(latestDueSlot(settings, device, new Date('2026-11-20T14:14:00Z')), '2026-11-20:1260');
  assert.equal(latestDueSlot(settings, device, new Date('2026-11-20T14:15:00Z')), null);
  assert.equal(latestDueSlot({ ...settings, schedule_enabled: 0 }, device, new Date('2026-11-20T02:00:00Z')), null);
});

test('subscription validation rejects an arbitrary server target and unpaired sends fail clearly', async t => {
  const f = await fixture(t);
  const admin = await f.login();
  assert.equal((await f.api('/api/admin/send', { method: 'POST', token: admin, data: sendData() })).status, 409);
  const device = await f.pair(admin);
  assert.equal((await f.api('/api/device/subscribe', { method: 'POST', token: device,
    data: { subscription: { ...subscription, endpoint: 'https://attacker.invalid/' } } })).status, 400);
  assert.equal(f.sent.length, 0);
});

test('racing different bodies cannot silently reuse the same idempotency key', async t => {
  const f = await fixture(t);
  const { admin } = await f.connect();
  const data = sendData();
  const results = await Promise.all(['Lời nhắn A', 'Lời nhắn B'].map(body => f.api('/api/admin/send', {
    method: 'POST', token: admin, data: { ...data, body }
  })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(f.sent.length, 1);
});

test('opening an older notification retrieves its exact message only for its receiving device', async t => {
  const f = await fixture(t);
  const { admin, device } = await f.connect();
  const first = await f.api('/api/admin/send', { method: 'POST', token: admin, data: { ...sendData(), body: 'Lời nhắn đầu' } });
  f.clock.ms += 1000;
  await f.api('/api/admin/send', { method: 'POST', token: admin, data: { ...sendData(), body: 'Lời nhắn mới hơn' } });
  const path = `/api/device/messages/${first.body.message.id}`;
  assert.equal((await f.api(path)).status, 401);
  assert.equal((await f.api(path, { token: device })).body.message.body, 'Lời nhắn đầu');
  const replacement = await f.pair(admin, true);
  assert.equal((await f.api(path, { token: replacement })).status, 404);
});

test('a delayed cron uses actual time for its send lease so concurrent catch-up cannot reclaim it', async t => {
  const f = await fixture(t, { legacy: true });
  const eventTime = f.clock.ms;
  f.clock.ms += 5 * 60000;
  let started;
  let release;
  const began = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let sends = 0;
  f.setDeliver(async () => { sends++; started(); await gate; return new Response(null, { status: 201 }); });
  const first = f.worker.scheduled({ scheduledTime: eventTime }, f.env);
  await began;
  const leased = await f.DB.prepare('SELECT lease_until FROM beo_messages').first();
  assert.equal(leased.lease_until, f.clock.ms / 1000 + 45);
  await f.worker.scheduled({ scheduledTime: eventTime + 60000 }, f.env);
  assert.equal(sends, 1);
  release();
  await first;
});

test('cron recovers a pending manual send left before a claim and stops exhausted stale leases', async t => {
  const f = await fixture(t);
  const { admin } = await f.connect();
  const sent = await f.api('/api/admin/send', { method: 'POST', token: admin, data: sendData() });
  await f.DB.prepare("UPDATE beo_messages SET status='pending',attempts=0,accepted_at=0 WHERE id=?").bind(sent.body.message.id).run();
  f.sent.length = 0;
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  assert.equal(f.sent.length, 1);
  await f.DB.prepare("UPDATE beo_messages SET status='sending',attempts=3,lease_until=? WHERE id=?")
    .bind(f.clock.ms / 1000 - 1, sent.body.message.id).run();
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  const state = await f.api('/api/admin/state', { token: admin });
  assert.equal(state.body.messages[0].status, 'failed');
  assert.equal(state.body.messages[0].retryAt, null);
  assert.equal(f.sent.length, 1);
});

test('turning the schedule off cancels unclaimed scheduled retries', async t => {
  const f = await fixture(t, { legacy: true, pushStatus: 503 });
  const admin = await f.login();
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  let state = await f.api('/api/admin/state', { token: admin });
  assert.ok(state.body.messages[0].retryAt);
  assert.equal((await f.api('/api/admin/settings', { method: 'POST', token: admin,
    data: { ...state.body.settings, enabled: false } })).status, 200);
  f.clock.ms += 60000;
  await f.worker.scheduled({ scheduledTime: f.clock.ms }, f.env);
  assert.equal(f.sent.length, 1);
  state = await f.api('/api/admin/state', { token: admin });
  assert.equal(state.body.messages[0].retryAt, null);
  assert.match(state.body.messages[0].error, /đã tắt/);
});


test('default scheduled copy rotates with the configured one-hour interval, while saved custom copy remains exact', async t => {
  const f = await fixture(t);
  const { admin } = await f.connect();
  const before = (await f.api('/api/admin/state', {token:admin})).body.settings;
  const updated = {...before, enabled:true, start:'09:00', end:'21:00', interval:60};
  assert.equal((await f.api('/api/admin/settings',{method:'POST',token:admin,data:updated})).status,200);
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  f.clock.ms+=60*60*1000;
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,2);
  assert.notEqual(f.sent[0].payload.body,f.sent[1].payload.body);
  assert.notEqual(f.sent[0].payload.title,f.sent[1].payload.title);
  const customized = {...updated,reminderMessage:'Lời nhắc em tự viết ♡'};
  assert.equal((await f.api('/api/admin/settings',{method:'POST',token:admin,data:customized})).status,200);
  f.clock.ms+=60*60*1000;
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent[2].payload.body,customized.reminderMessage);
  assert.equal(f.sent[2].payload.title,customized.notificationTitle);
});


test('admin accepts arbitrary whole-minute reminder intervals from 5 to 720 without resetting existing settings', async t => {
  const f = await fixture(t);
  const {admin} = await f.connect();
  const original = (await f.api('/api/admin/state',{token:admin})).body.settings;
  for(const interval of [5,7,10,13,15,30,45,90,120,180,720]) {
    const value = {...original,interval,enabled:true};
    const result = await f.api('/api/admin/settings',{method:'POST',token:admin,data:value});
    assert.equal(result.status,200,'interval='+interval);
    assert.equal(result.body.settings.interval,interval);
  }
  for(const interval of [0,1,4,5.5,721,900,-10]) {
    const value = {...original,interval,enabled:true};
    const result = await f.api('/api/admin/settings',{method:'POST',token:admin,data:value});
    assert.equal(result.status,400,'reject invalid interval='+interval);
  }
  const current = (await f.api('/api/admin/state',{token:admin})).body.settings;
  assert.equal(current.interval,720,'invalid input cannot overwrite a saved interval');
});

test('5-minute scheduled reminders deliver alternating titles and bodies without duplicate cron deliveries', async t => {
  const f = await fixture(t);
  const {admin} = await f.connect();
  const state = (await f.api('/api/admin/state',{token:admin})).body.settings;
  const update = {...state,enabled:true,start:'09:00',end:'09:20',interval:5};
  assert.equal((await f.api('/api/admin/settings',{method:'POST',token:admin,data:update})).status,200);
  for(const minute of [0,5,10,15]) {
    f.clock.ms=Date.UTC(2026,10,20,2,minute);
    await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  }
  assert.equal(f.sent.length,4);
  for(let i=1;i<f.sent.length;i++) {
    assert.notEqual(f.sent[i-1].payload.title,f.sent[i].payload.title);
    assert.notEqual(f.sent[i-1].payload.body,f.sent[i].payload.body);
  }
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,4,'same cron minute must not push twice');
});

test('admin history supports authorized search, pagination and validated filters', async t => {
  const f = await fixture(t);
  const {admin} = await f.connect();
  assert.equal((await f.api('/api/admin/history')).status,401,'history is admin-only');
  for(let i=0;i<5;i++) {
    const response=await f.api('/api/admin/send',{method:'POST',token:admin,
      data:{title:'Lời gửi số '+i,body:'Beo uống nước nhé, số '+i,requestId:crypto.randomUUID()}});
    assert.equal(response.status,200);
    f.clock.ms+=7000;
  }
  const first=await f.api('/api/admin/history?limit=2&offset=0&source=manual&status=accepted',{token:admin});
  assert.equal(first.status,200);
  assert.equal(first.body.total,5);
  assert.equal(first.body.messages.length,2);
  const second=await f.api('/api/admin/history?limit=2&offset=2',{token:admin});
  assert.equal(second.status,200);
  assert.equal(second.body.messages.length,2);
  assert.notEqual(first.body.messages[0].id,second.body.messages[0].id);
  const matched=await f.api('/api/admin/history?q='+encodeURIComponent('số 3'),{token:admin});
  assert.equal(matched.status,200);
  assert.equal(matched.body.total,1);
  assert.equal(matched.body.messages[0].title,'Lời gửi số 3');
  for(const query of ['limit=101','limit=-1','offset=-5','status=invalid','source=other']) {
    assert.equal((await f.api('/api/admin/history?'+query,{token:admin})).status,400,query);
  }
});

test('only authenticated admin can unlink the sole receiving iPhone with explicit confirmation', async t => {
  const f = await fixture(t);
  const {admin,device} = await f.connect();
  assert.equal((await f.api('/api/admin/device/disconnect',{method:'POST',data:{confirm:true}})).status,401);
  assert.equal((await f.api('/api/admin/device/disconnect',{method:'POST',token:admin,data:{confirm:false}})).status,400);
  assert.equal((await f.api('/api/device/me',{token:device})).status,200);
  const result=await f.api('/api/admin/device/disconnect',{method:'POST',token:admin,data:{confirm:true}});
  assert.equal(result.status,200);
  assert.equal(result.body.paired,false);
  assert.equal((await f.api('/api/device/me',{token:device})).status,401,'old device credential is revoked');
  const state=(await f.api('/api/admin/state',{token:admin})).body;
  assert.equal(state.device.paired,false);
  assert.equal(state.device.pushEnabled,false);
  assert.equal((await f.api('/api/admin/device/disconnect',{method:'POST',token:admin,data:{confirm:true}})).status,200);
});


test('extra work and lunch routines start disabled; migration remains idempotent and preserves existing phone', async t => {
  const f=await fixture(t,{legacy:true});
  const before=await f.DB.prepare('SELECT * FROM beo_receiver').first();
  f.DB.exec(routinesMigration);
  const admin=await f.login();
  const result=await f.api('/api/admin/routines',{token:admin});
  assert.equal(result.status,200);
  assert.deepEqual(result.body.routines.map(x=>x.enabled),[false,false]);
  assert.equal(result.body.routines.length,2);
  assert.deepEqual(await f.DB.prepare('SELECT * FROM beo_receiver').first(),before);
  assert.equal((await f.api('/api/admin/routines')).status,401);
  assert.equal((await f.api('/api/device/me',{token:f.legacyToken})).status,200);
});

test('admin adds, edits and deletes custom notification schedules with validation',async t=>{
  const f=await fixture(t), admin=await f.login();
  const data={label:'Nghỉ tay',title:'BÉ ƠI, NGHỈ MỘT CHÚT ♡',
    body:'Nghỉ tay chút nha em.',time:'15:00',days:127,enabled:true};
  const added=await f.api('/api/admin/routines',{method:'POST',token:admin,data});
  assert.equal(added.status,201);
  const id=added.body.routine.id;
  assert.equal((await f.api('/api/admin/routines',{method:'POST',token:admin,data:{...data,days:0}})).status,400);
  assert.equal((await f.api('/api/admin/routines/'+id,{method:'PATCH',data})).status,401);
  const changed=await f.api('/api/admin/routines/'+id,{method:'PATCH',token:admin,data:{...data,days:62,time:'15:10'}});
  assert.equal(changed.body.routine.time,'15:10');
  assert.equal(changed.body.routine.days,62);
  assert.equal((await f.api('/api/admin/routines/'+id,{method:'DELETE',token:admin})).status,200);
});

test('weekday morning and daily lunch have independent cron slots without duplicate sends',async t=>{
  const f=await fixture(t), {admin}=await f.connect();
  const routines=(await f.api('/api/admin/routines',{token:admin})).body.routines;
  for(const r of routines) {
    assert.equal((await f.api('/api/admin/routines/'+r.id,{method:'PATCH',token:admin,
      data:{...r,enabled:true}})).status,200);
  }
  f.clock.ms=Date.UTC(2026,10,20,1,0);
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,1);
  assert.match(f.sent[0].payload.title,/ĐI LÀM/);
  f.clock.ms=Date.UTC(2026,10,20,4,50);
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,2);
  assert.match(f.sent[1].payload.title,/ĂN TRƯA/);
  f.clock.ms=Date.UTC(2026,10,21,1,0); // Saturday
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,2);
});

test('advanced migration is additive; legacy routines remain intact and advanced CRUD persists',async t=>{
  const f=await fixture(t,{legacy:true}),admin=await f.login();
  const before=(await f.api('/api/admin/routines',{token:admin})).body;
  assert.equal(before.advanced,false);
  const migration=await readFile(new URL('./migrations/0004-flexible-reminders.sql',import.meta.url),'utf8');
  const draft={label:'Uống nước',title:'Uống nước nhé',body:'Một ngụm nước',time:'08:00',days:127,enabled:true,
    schedule:{kind:'repeat',start:'08:00',end:'20:00',interval:60,messages:[{title:'Beo ơi',body:'Uống nước nè'}]}};
  assert.equal((await f.api('/api/admin/routines',{method:'POST',token:admin,data:draft})).status,503);
  f.DB.exec(migration); f.DB.exec(migration);
  const after=(await f.api('/api/admin/routines',{token:admin})).body;
  assert.equal(after.advanced,true);
  assert.deepEqual(after.routines,before.routines);
  const created=await f.api('/api/admin/routines',{method:'POST',token:admin,data:draft});
  assert.equal(created.status,201,JSON.stringify(created.body));
  const r=created.body.routine;
  assert.deepEqual(r.schedule,draft.schedule);
  const bad=await f.api('/api/admin/routines/'+r.id,{method:'PATCH',token:admin,data:{...r,schedule:{kind:'random',start:'08:00',end:'08:05',count:3}}});
  assert.equal(bad.status,400);
  const toggled=await f.api('/api/admin/routines/'+r.id,{method:'PATCH',token:admin,data:{...r,enabled:false}});
  assert.equal(toggled.body.routine.enabled,false);
  assert.deepEqual(toggled.body.routine.schedule,draft.schedule);
  assert.equal((await f.api('/api/admin/routines/'+r.id,{method:'DELETE',token:admin})).status,200);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM beo_routine_options').first()).n,0);
  assert.equal((await f.api('/api/device/me',{token:f.legacyToken})).status,200);
});

test('advanced repeat and date schedules dispatch independently with deduplication',async t=>{
  const f=await fixture(t),{admin}=await f.connect();
  f.DB.exec(await readFile(new URL('./migrations/0004-flexible-reminders.sql',import.meta.url),'utf8'));
  const base={label:'Nghỉ tay',title:'Nhắc Beo',body:'Nghỉ chút nhé',time:'09:00',days:127,enabled:true};
  for(const schedule of [{kind:'repeat',start:'09:00',end:'10:00',interval:30},{kind:'date',date:'2026-11-20',cycle:'once'}]){
    const result=await f.api('/api/admin/routines',{method:'POST',token:admin,data:{...base,schedule}});
    assert.equal(result.status,201,JSON.stringify(result.body));
  }
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,2);
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,2);
  f.clock.ms+=30*60000;
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,3);
  f.clock.ms+=86400000-30*60000;
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(f.sent.length,4);
});

test('system health is private, shows real query metadata and counts local calendar days',async t=>{
  const f=await fixture(t,{legacy:true}),admin=await f.login();
  const now=Math.floor(f.clock.ms/1000);
  // 09:00 in Vietnam; local midnight is nine hours ago.
  const insert=async at=>f.DB.prepare('INSERT INTO beo_messages (id,device_id,dedupe_key,title,body,source,receipt_hash,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),'device',crypto.randomUUID(),'Beo','Nhớ uống nước','manual','test-hash',at).run();
  await insert(now-9*3600-1);await insert(now-9*3600);await insert(now);await insert(now-31*86400);
  assert.equal((await f.api('/api/admin/system')).status,401);
  assert.equal((await f.api('/api/admin/system',{token:f.legacyToken})).status,401);
  const health=await f.api('/api/admin/system',{token:admin});
  assert.equal(health.status,200,JSON.stringify(health.body));
  assert.equal(health.body.totalMessages,4);
  assert.equal(health.body.todayMessages,2);
  assert.equal(health.body.expiredMessages,1);
  assert.ok(health.body.sizeBytes>0);
  assert.equal(health.body.freeLimitBytes,500000000);
  assert.equal(health.body.retentionDays,30);
  assert.equal(health.body.retentionEditable,false);
  assert.equal((await f.api('/api/admin/system/retention',{method:'POST',token:admin,data:{days:60,confirm:true}})).status,503);
  const result=await f.api('/api/admin/system/export',{token:admin});
  assert.equal(result.body.messages.length,4);
  assert.equal(result.body.truncated,false);
  assert.ok(result.body.messages.every(m=>!Object.hasOwn(m,'receipt_hash')&&!Object.hasOwn(m,'dedupe_key')&&!Object.hasOwn(m,'device_id')));
  assert.equal((await f.api('/api/admin/system/export')).status,401);
});

test('retention migration preserves settings and only confirmed cleanup removes expired messages',async t=>{
  const f=await fixture(t,{legacy:true}),admin=await f.login();
  const now=Math.floor(f.clock.ms/1000);
  const insert=async (id,days)=>f.DB.prepare('INSERT INTO beo_messages (id,device_id,dedupe_key,title,body,source,receipt_hash,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id,'device',id,'Beo','Lời nhắn','manual','test-hash',now-days*86400).run();
  await insert('fresh',1);await insert('month',40);await insert('older',80);
  const before=await f.DB.prepare('SELECT * FROM beo_settings').first();
  const migration=await readFile(new URL('./migrations/0005-system-health.sql',import.meta.url),'utf8');
  f.DB.exec(migration);f.DB.exec(migration);
  const url='/api/admin/system/retention',clean='/api/admin/system/cleanup';
  assert.equal((await f.api(url,{method:'POST',token:admin,data:{days:7,confirm:true}})).status,400);
  assert.equal((await f.api(url,{method:'POST',token:admin,data:{days:60}})).status,400);
  assert.equal((await f.api(url,{method:'POST',token:admin,data:{days:60,confirm:true}})).status,200);
  f.DB.exec(migration);
  assert.equal((await f.api('/api/admin/system',{token:admin})).body.retentionDays,60);
  assert.equal((await f.api(clean,{method:'POST',token:admin,data:{confirm:true,retentionDays:30}})).status,409);
  assert.equal((await f.api(clean,{method:'POST',token:admin,data:{retentionDays:60}})).status,400);
  assert.equal((await f.api(clean,{method:'POST',data:{confirm:true,retentionDays:60}})).status,401);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM beo_messages').first()).n,3);
  const result=await f.api(clean,{method:'POST',token:admin,data:{confirm:true,retentionDays:60}});
  assert.equal(result.status,200);assert.equal(result.body.deleted,1);
  assert.deepEqual((await f.DB.prepare('SELECT id FROM beo_messages ORDER BY id').all()).results.map(x=>x.id),['fresh','month']);
  assert.deepEqual(await f.DB.prepare('SELECT * FROM beo_settings').first(),before);
  assert.equal((await f.api('/api/device/me',{token:f.legacyToken})).status,200);
  await f.api(url,{method:'POST',token:admin,data:{days:30,confirm:true}});
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM beo_messages').first()).n,2,'policy change alone does not delete');
  await f.worker.scheduled({scheduledTime:f.clock.ms},f.env);
  assert.equal(await f.DB.prepare("SELECT id FROM beo_messages WHERE id='month'").first(),null);
  assert.ok(await f.DB.prepare("SELECT id FROM beo_messages WHERE id='fresh'").first());
});
