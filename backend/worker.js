import { dueSlot, goodName, goodSchedule, randomSecret, safeCompare, sha256, validPushSubscription } from './lib.js';
import { selectReminderMessage, selectReminderTitle } from './reminder-messages.js';
import { MAX_ROUTINES, ROUTINE_ID, validRoutine, exposeRoutine, routineSlot } from './routines.js';

export const ORIGIN = 'https://hungdeniubeo.github.io';
export const ROOM_ID = 'water-beo-single-device';
const SESSION_SECONDS = 12 * 60 * 60;
const PAIR_SECONDS = 10 * 60;
const RETRY_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 3;
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
function cors(response, origin) {
  if (origin !== ORIGIN) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', ORIGIN);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  headers.set('Access-Control-Max-Age', '1800');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
async function readJson(request) {
  if (Number(request.headers.get('content-length')) > 8000) fail(413, 'Nội dung quá dài.');
  const text = await request.text();
  if (text.length > 8000) fail(413, 'Nội dung quá dài.');
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Dữ liệu không hợp lệ.');
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, 'Dữ liệu không hợp lệ.');
  }
}
const adminSecret = env => env.ADMIN_SECRET || env.OWNER_SETUP_CODE || '';
function configured(env) {
  return Boolean(env.DB && adminSecret(env).length >= 16 && env.VAPID_PUBLIC_KEY &&
    !env.VAPID_PUBLIC_KEY.startsWith('REPLACE') && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}
async function schemaReady(env) {
  if (!env.DB) return false;
  try { return Boolean(await env.DB.prepare('SELECT id FROM beo_settings WHERE id=1').first()); }
  catch { return false; }
}
async function requireSchema(env) {
  if (!env.DB) fail(503, 'Máy chủ chưa kết nối cơ sở dữ liệu.');
  if (!(await schemaReady(env))) fail(503, 'Máy chủ cần cập nhật cơ sở dữ liệu trước khi dùng trang admin.');
}
const plainText = (value, max, multiline = true) => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value) &&
  (multiline || !/[\r\n\t]/.test(value));
function validateSettings(value) {
  if (!goodName(value.recipientName) || !plainText(value.appTitle, 40, false) ||
      !plainText(value.homeMessage, 240) || !plainText(value.notificationTitle, 70, false) ||
      !plainText(value.reminderMessage, 150) || !goodSchedule(value)) {
    fail(400, 'Kiểm tra lại tên, nội dung và khung giờ nhắc.');
  }
}
const exposeSettings = row => ({
  recipientName: row.recipient_name, appTitle: row.app_title, homeMessage: row.home_message,
  notificationTitle: row.notification_title, reminderMessage: row.reminder_message,
  enabled: Boolean(row.schedule_enabled), start: row.start_time, end: row.end_time,
  interval: row.interval_minutes, timezone: row.timezone
});
const exposeMessage = row => row ? ({
  id: row.id, title: row.title, body: row.body, source: row.source, status: row.status,
  createdAt: row.created_at, acceptedAt: row.accepted_at || null,
  receivedAt: row.received_at || null, openedAt: row.opened_at || null,
  error: row.error || '', retryAt: row.next_attempt_at || null
}) : null;
const getSettings = env => env.DB.prepare('SELECT * FROM beo_settings WHERE id=1').first();
async function routinesReady(env) {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='beo_routines'").first();
  return Boolean(row);
}
async function requireRoutines(env) {
  if (!(await routinesReady(env))) fail(503, 'Cần cập nhật cơ sở dữ liệu cho lời nhắc mới.');
}
const getReceiver = env => env.DB.prepare(`SELECT d.*, r.last_seen_at FROM beo_receiver r
  JOIN devices d ON d.id=r.device_id WHERE r.id=1 AND d.room_id=?`).bind(ROOM_ID).first();
async function authDevice(request, env) {
  const match = /^Bearer ([a-f0-9-]{36})\.([a-zA-Z0-9_-]{30,100})$/.exec(request.headers.get('Authorization') || '');
  if (!match) fail(401, 'iPhone chưa được kết nối.');
  const device = await getReceiver(env);
  if (!device || device.id !== match[1] || !safeCompare(device.token_hash, await sha256(match[2]))) {
    fail(401, 'Kết nối iPhone đã hết hạn. Xin mã kết nối mới từ admin.');
  }
  return device;
}
async function authAdmin(request, env, now) {
  const match = /^Bearer (adm_[a-zA-Z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '');
  if (!match) fail(401, 'Hãy đăng nhập trang admin.');
  const tokenHash = await sha256(match[1]);
  const session = await env.DB.prepare('SELECT * FROM beo_admin_sessions WHERE token_hash=? AND expires_at>?')
    .bind(tokenHash, now).first();
  if (!session || !safeCompare(session.credential_hash, await sha256(adminSecret(env)))) {
    fail(401, 'Phiên admin đã hết hạn. Hãy đăng nhập lại.');
  }
  return tokenHash;
}
async function rateLimit(env, key, max, window, now) {
  const bucket = Math.floor(now / window);
  const result = await env.DB.prepare(`INSERT INTO beo_rate_limits (key,hits,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits`).bind(`${key}:${bucket}`, (bucket + 2) * window).first();
  if (result.hits > max) fail(429, 'Thử quá nhiều lần. Đợi vài phút rồi thử lại nhé.');
}
async function limitPublic(request, env, kind, now) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await rateLimit(env, `${kind}:ip:${await sha256(ip)}`, 10, 900, now);
  await rateLimit(env, `${kind}:global`, 100, 900, now);
}
async function pairingHash(code, env) {
  return sha256(`pairing:${adminSecret(env)}:${code}`);
}
async function receiptToken(id, deviceId, env) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(adminSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`receipt:${id}:${deviceId}`)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function sendWebPush({ env, subscription, payload }) {
  const { buildPushPayload } = await import('@block65/webcrypto-web-push');
  const options = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: RETRY_SECONDS } }, subscription, {
    subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY
  });
  // Workers rejects redirect:'error' before sending. Return redirects without following them;
  // deliver() accepts only 2xx, so authorization and ciphertext stay at the registered endpoint.
  return fetch(subscription.endpoint, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) });
}
export function latestDueSlot(settings, device, date) {
  if (!settings.schedule_enabled || !device?.push_json) return null;
  const schedule = { ...device, reminder_enabled: 1, start_time: settings.start_time,
    end_time: settings.end_time, interval_minutes: settings.interval_minutes, timezone: settings.timezone };
  // A late cron invocation may catch up for 14 minutes; a whole missed day is never replayed.
  for (let offset = 0; offset < 15; offset++) {
    const slot = dueSlot(schedule, new Date(date.getTime() - offset * 60000));
    if (slot) return slot;
  }
  return null;
}

export function createWorker({ now = () => Date.now(), sendPush = sendWebPush } = {}) {
  const seconds = () => Math.floor(now() / 1000);
  async function createMessage(env, device, { title, body, source, dedupeKey }, timestamp) {
    const id = crypto.randomUUID();
    const token = await receiptToken(id, device.id, env);
    await env.DB.prepare(`INSERT OR IGNORE INTO beo_messages
      (id,device_id,dedupe_key,title,body,source,receipt_hash,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id, device.id, dedupeKey, title, body, source, await sha256(token), timestamp).run();
    return env.DB.prepare('SELECT * FROM beo_messages WHERE dedupe_key=?').bind(dedupeKey).first();
  }
  async function deliver(env, device, message, timestamp) {
    const claimed = await env.DB.prepare(`UPDATE beo_messages SET status='sending',attempts=attempts+1,lease_until=?,next_attempt_at=0
      WHERE id=? AND device_id=? AND attempts<? AND created_at>=? AND
      (status='pending' OR (status='failed' AND next_attempt_at>0 AND next_attempt_at<=?) OR (status='sending' AND lease_until<?))`)
      .bind(timestamp + 45, message.id, device.id, MAX_ATTEMPTS, timestamp - RETRY_SECONDS, timestamp, timestamp).run();
    if (!claimed.meta.changes) return env.DB.prepare('SELECT * FROM beo_messages WHERE id=?').bind(message.id).first();
    const current = await env.DB.prepare('SELECT * FROM beo_messages WHERE id=?').bind(message.id).first();
    let retryable = false;
    let error = '';
    try {
      const subscription = JSON.parse(device.push_json);
      const token = await receiptToken(current.id, device.id, env);
      await env.DB.prepare('UPDATE beo_messages SET receipt_hash=? WHERE id=?').bind(await sha256(token), current.id).run();
      const response = await sendPush({ env, subscription, payload: {
        id: current.id, title: current.title, body: current.body, receiptToken: token
      } });
      if (response.status >= 200 && response.status < 300) {
        await env.DB.prepare(`UPDATE beo_messages SET status=CASE WHEN opened_at>0 THEN 'opened' WHEN received_at>0 THEN 'received' ELSE 'accepted' END,
          accepted_at=CASE WHEN accepted_at=0 THEN ? ELSE accepted_at END,lease_until=0,next_attempt_at=0,error='' WHERE id=?`)
          .bind(timestamp, current.id).run();
        if (current.source === 'scheduled') {
          const slot = current.dedupe_key.slice(`scheduled:${device.id}:`.length);
          await env.DB.prepare('UPDATE devices SET last_sent_slot=? WHERE id=?').bind(slot, device.id).run();
        }
        return env.DB.prepare('SELECT * FROM beo_messages WHERE id=?').bind(current.id).first();
      }
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=? AND push_endpoint=?')
          .bind(device.id, device.push_endpoint).run();
        error = 'Kết nối thông báo đã hết hạn. Mở app trên iPhone và bật nhận thông báo lại.';
      } else {
        retryable = response.status === 429 || response.status >= 500;
        error = response.status === 401 || response.status === 403
          ? 'Dịch vụ thông báo từ chối xác thực. Kiểm tra cặp khóa VAPID trên máy chủ.'
          : `Dịch vụ thông báo trả lỗi ${response.status}.`;
      }
    } catch {
      retryable = true;
      error = 'Chưa xác nhận được kết quả gửi từ dịch vụ thông báo.';
    }
    const retryAt = retryable && current.attempts < MAX_ATTEMPTS && timestamp + 60 * current.attempts <= current.created_at + RETRY_SECONDS
      ? timestamp + 60 * current.attempts : 0;
    await env.DB.prepare(`UPDATE beo_messages SET status='failed',lease_until=0,next_attempt_at=?,error=?
      WHERE id=? AND received_at=0 AND opened_at=0`).bind(retryAt, error, current.id).run();
    return env.DB.prepare('SELECT * FROM beo_messages WHERE id=?').bind(current.id).first();
  }

  async function route(request, env) {
    const path = new URL(request.url).pathname;
    const method = request.method;
    const timestamp = seconds();
    if (path === '/api/config' && method === 'GET') {
      const migrated = await schemaReady(env);
      const ready = configured(env) && migrated;
      return json({ apiVersion: 2, ready, vapidPublicKey: ready ? env.VAPID_PUBLIC_KEY : null,
        capabilities: {customMinutes:{min:5,max:720},history:true,disconnect:true},
        mode: 'admin-receiver', reason: !migrated ? 'migration-required' : !configured(env) ? 'configuration-required' : null });
    }
    await requireSchema(env);
    if (path === '/api/activate') fail(410, 'Dùng mã kết nối tạo từ trang admin.');
    if (path === '/api/admin/login' && method === 'POST') {
      if (adminSecret(env).length < 16) fail(503, 'Chưa thiết lập khóa admin trên máy chủ.');
      await limitPublic(request, env, 'login', timestamp);
      const data = await readJson(request);
      if (typeof data.code !== 'string' || !safeCompare(await sha256(data.code), await sha256(adminSecret(env)))) {
        fail(401, 'Khóa admin chưa đúng.');
      }
      const token = `adm_${randomSecret()}`;
      const expiresAt = timestamp + SESSION_SECONDS;
      await env.DB.prepare('INSERT INTO beo_admin_sessions (token_hash,credential_hash,created_at,expires_at) VALUES (?,?,?,?)')
        .bind(await sha256(token), await sha256(adminSecret(env)), timestamp, expiresAt).run();
      return json({ token, expiresAt });
    }
    if (path === '/api/pair' && method === 'POST') {
      if (!configured(env)) fail(503, 'Dịch vụ thông báo chưa sẵn sàng.');
      await limitPublic(request, env, 'pair', timestamp);
      const data = await readJson(request);
      const code = typeof data.code === 'string' ? data.code.replace(/[\s-]/g, '') : '';
      if (!/^\d{8}$/.test(code)) fail(400, 'Nhập mã kết nối gồm 8 chữ số.');
      const id = crypto.randomUUID();
      const secret = randomSecret();
      const tokenHash = await sha256(secret);
      const codeHash = await pairingHash(code, env);
      // D1 batch is one transaction. Every dependent mutation is gated by this unique claim.
      const results = await env.DB.batch([
        env.DB.prepare(`UPDATE beo_pairing SET consumed_by=?,consumed_at=? WHERE id=1 AND code_hash=? AND expires_at>?
          AND consumed_at IS NULL AND (replace_existing=1 OR NOT EXISTS(SELECT 1 FROM beo_receiver WHERE id=1 AND device_id IS NOT NULL))`)
          .bind(id, timestamp, codeHash, timestamp),
        env.DB.prepare(`INSERT OR IGNORE INTO rooms (id,created_at) SELECT ?,? WHERE EXISTS(SELECT 1 FROM beo_pairing WHERE consumed_by=?)`)
          .bind(ROOM_ID, timestamp, id),
        env.DB.prepare(`INSERT INTO devices (id,room_id,token_hash,name,created_at)
          SELECT ?,?,?,recipient_name,? FROM beo_settings WHERE id=1 AND EXISTS(SELECT 1 FROM beo_pairing WHERE consumed_by=?)`)
          .bind(id, ROOM_ID, tokenHash, timestamp, id),
        env.DB.prepare(`UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE room_id=? AND id<>?
          AND EXISTS(SELECT 1 FROM beo_pairing WHERE consumed_by=?)`).bind(ROOM_ID, id, id),
        env.DB.prepare(`UPDATE beo_receiver SET device_id=?,last_seen_at=? WHERE id=1
          AND EXISTS(SELECT 1 FROM beo_pairing WHERE consumed_by=?)`).bind(id, timestamp, id)
      ]);
      if (!results[0].meta.changes) fail(409, 'Mã kết nối không đúng, đã dùng hoặc đã hết hạn. Xin mã mới từ admin.');
      return json({ device: { id, secret } }, 201);
    }
    if (path === '/api/receipts' && method === 'POST') {
      const data = await readJson(request);
      if (typeof data.id !== 'string' || !/^[a-f0-9-]{36}$/.test(data.id) ||
          typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token) || !['received', 'opened'].includes(data.event)) {
        fail(400, 'Biên nhận không hợp lệ.');
      }
      const hash = await sha256(data.token);
      const opened = data.event === 'opened';
      const updated = await env.DB.prepare(`UPDATE beo_messages SET
        received_at=CASE WHEN received_at=0 THEN ? ELSE received_at END,
        opened_at=CASE WHEN ?=1 AND opened_at=0 THEN ? ELSE opened_at END,
        status=CASE WHEN ?=1 OR opened_at>0 THEN 'opened' ELSE 'received' END,
        next_attempt_at=0,lease_until=0,error='' WHERE id=? AND receipt_hash=?`)
        .bind(timestamp, opened ? 1 : 0, timestamp, opened ? 1 : 0, data.id, hash).run();
      if (!updated.meta.changes) fail(404, 'Không tìm thấy thông báo.');
      return json({ ok: true });
    }
    if (path.startsWith('/api/admin/')) {
      const sessionHash = await authAdmin(request, env, timestamp);
      if (path === '/api/admin/logout' && method === 'POST') {
        await env.DB.prepare('DELETE FROM beo_admin_sessions WHERE token_hash=?').bind(sessionHash).run();
        return json({ ok: true });
      }
      if (path === '/api/admin/state' && method === 'GET') {
        const [settings, device, messages] = await Promise.all([
          getSettings(env), getReceiver(env), env.DB.prepare('SELECT * FROM beo_messages ORDER BY created_at DESC,id DESC LIMIT 30').all()
        ]);
        return json({ settings: exposeSettings(settings),
          device: { paired: Boolean(device), pushEnabled: Boolean(device?.push_json), createdAt: device?.created_at || null,
            lastSeenAt: device?.last_seen_at || null },
          service: { ready: configured(env) }, messages: messages.results.map(exposeMessage) });
      }
      if (path === '/api/admin/routines' && method === 'GET') {
        await requireRoutines(env);
        const result = await env.DB.prepare('SELECT * FROM beo_routines ORDER BY time_local,id').all();
        return json({ routines: result.results.map(exposeRoutine) });
      }
      if (path === '/api/admin/routines' && method === 'POST') {
        await requireRoutines(env);
        const data = await readJson(request);
        if (!validRoutine(data)) fail(400, 'Kiểm tra lại giờ, thứ trong tuần, tiêu đề và nội dung.');
        const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM beo_routines').first();
        if (count.n >= MAX_ROUTINES) fail(409, 'Tối đa 20 lời nhắc tự động. Xóa bớt lời nhắc không dùng.');
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO beo_routines (id,label,title,body,time_local,days_mask,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(id,data.label.trim(),data.title.trim(),data.body.trim(),data.time,data.days,data.enabled?1:0,timestamp,timestamp).run();
        return json({routine:exposeRoutine(await env.DB.prepare('SELECT * FROM beo_routines WHERE id=?').bind(id).first())},201);
      }
      const routineMatch = /^\/api\/admin\/routines\/([a-z0-9-]+)$/.exec(path);
      if (routineMatch && ['PATCH','DELETE'].includes(method)) {
        await requireRoutines(env);
        const id = routineMatch[1];
        if (!ROUTINE_ID.test(id)) fail(404,'Không tìm thấy lời nhắc.');
        const existing = await env.DB.prepare('SELECT * FROM beo_routines WHERE id=?').bind(id).first();
        if (!existing) fail(404,'Không tìm thấy lời nhắc.');
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM beo_routines WHERE id=?').bind(id).run();
          await env.DB.prepare("UPDATE beo_messages SET status='failed',next_attempt_at=0,lease_until=0,error='Lời nhắc đã bị xóa.' WHERE source='scheduled' AND dedupe_key LIKE ? AND (status='pending' OR (status='failed' AND next_attempt_at>0))")
            .bind('routine:%:' + id + ':%').run();
          return json({ok:true});
        }
        const data = await readJson(request);
        if (!validRoutine(data)) fail(400,'Kiểm tra lại giờ, thứ trong tuần, tiêu đề và nội dung.');
        await env.DB.prepare('UPDATE beo_routines SET label=?,title=?,body=?,time_local=?,days_mask=?,enabled=?,updated_at=? WHERE id=?')
          .bind(data.label.trim(),data.title.trim(),data.body.trim(),data.time,data.days,data.enabled?1:0,timestamp,id).run();
        if (!data.enabled) {
          await env.DB.prepare("UPDATE beo_messages SET status='failed',next_attempt_at=0,lease_until=0,error='Lời nhắc đã được tắt.' WHERE source='scheduled' AND dedupe_key LIKE ? AND (status='pending' OR (status='failed' AND next_attempt_at>0))")
            .bind('routine:%:' + id + ':%').run();
        }
        return json({routine:exposeRoutine(await env.DB.prepare('SELECT * FROM beo_routines WHERE id=?').bind(id).first())});
      }
      if (path === '/api/admin/history' && method === 'GET') {
        const params = new URL(request.url).searchParams;
        const limit = Number(params.get('limit') ?? 30);
        const offset = Number(params.get('offset') ?? 0);
        const source = params.get('source') || 'all';
        const status = params.get('status') || 'all';
        const search = (params.get('q') || '').trim();
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
            !Number.isInteger(offset) || offset < 0 || offset > 10000 ||
            !['all','manual','scheduled'].includes(source) ||
            !['all','pending','sending','accepted','received','opened','failed'].includes(status) ||
            search.length > 80) fail(400, 'Bộ lọc lịch sử không hợp lệ.');
        const filters = [];
        const args = [];
        if (source !== 'all') { filters.push('source=?'); args.push(source); }
        if (status !== 'all') { filters.push('status=?'); args.push(status); }
        if (search) { filters.push('(title LIKE ? OR body LIKE ?)'); args.push('%'+search+'%', '%'+search+'%'); }
        const where = filters.length ? ' WHERE '+filters.join(' AND ') : '';
        const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM beo_messages'+where).bind(...args).first();
        const rows = await env.DB.prepare('SELECT * FROM beo_messages'+where+
          ' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(...args,limit,offset).all();
        return json({ messages: rows.results.map(exposeMessage), total: count.n, offset, limit });
      }
      if (path === '/api/admin/device/disconnect' && method === 'POST') {
        const data = await readJson(request);
        if (data.confirm !== true) fail(400, 'Cần xác nhận ngắt kết nối iPhone.');
        const device = await getReceiver(env);
        if (!device) return json({ok:true,paired:false});
        await env.DB.batch([
          env.DB.prepare('UPDATE beo_receiver SET device_id=NULL,last_seen_at=0 WHERE id=1 AND device_id=?').bind(device.id),
          env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=?').bind(device.id),
          env.DB.prepare('UPDATE beo_pairing SET expires_at=0 WHERE id=1 AND consumed_at IS NULL'),
          env.DB.prepare(`UPDATE beo_messages SET status='failed',next_attempt_at=0,lease_until=0,
            error='iPhone đã được ngắt kết nối.' WHERE device_id=? AND source='scheduled' AND status IN ('pending','sending')`).bind(device.id)
        ]);
        return json({ok:true,paired:false});
      }
      if (path === '/api/admin/settings' && method === 'POST') {
        const data = await readJson(request);
        validateSettings(data);
        await env.DB.prepare(`UPDATE beo_settings SET recipient_name=?,app_title=?,home_message=?,notification_title=?,reminder_message=?,
          schedule_enabled=?,start_time=?,end_time=?,interval_minutes=?,timezone=?,updated_at=? WHERE id=1`)
          .bind(data.recipientName.trim(), data.appTitle.trim(), data.homeMessage.trim(), data.notificationTitle.trim(),
            data.reminderMessage.trim(), data.enabled ? 1 : 0, data.start, data.end, Number(data.interval), data.timezone, timestamp).run();
        if (!data.enabled) {
          await env.DB.prepare(`UPDATE beo_messages SET status='failed',next_attempt_at=0,lease_until=0,error='Đã dừng vì lịch nhắc đã tắt.'
            WHERE source='scheduled' AND dedupe_key LIKE 'scheduled:%'
            AND (status='pending' OR (status='failed' AND next_attempt_at>0))`).run();
        }
        return json({ ok: true, settings: exposeSettings(await getSettings(env)) });
      }
      if (path === '/api/admin/pairing' && method === 'POST') {
        const data = await readJson(request);
        if (typeof data.replace !== 'boolean') fail(400, 'Thiếu lựa chọn kết nối iPhone.');
        if (!configured(env)) fail(503, 'Dịch vụ thông báo chưa sẵn sàng.');
        if (await getReceiver(env) && !data.replace) fail(409, 'Đã có một iPhone. Chọn thay iPhone nếu cần kết nối thiết bị khác.');
        // Rejection sampling avoids modulo bias in the eight-digit code.
        let raw;
        do { raw = crypto.getRandomValues(new Uint32Array(1))[0]; } while (raw >= 4200000000);
        const code = String(raw % 100000000).padStart(8, '0');
        const expiresAt = timestamp + PAIR_SECONDS;
        await env.DB.prepare(`INSERT INTO beo_pairing (id,code_hash,expires_at,replace_existing,created_at) VALUES (1,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,
          replace_existing=excluded.replace_existing,created_at=excluded.created_at,consumed_by=NULL,consumed_at=NULL`)
          .bind(await pairingHash(code, env), expiresAt, data.replace ? 1 : 0, timestamp).run();
        return json({ code, expiresAt }, 201);
      }
      if (path === '/api/admin/send' && method === 'POST') {
        if (!configured(env)) fail(503, 'Dịch vụ thông báo chưa sẵn sàng.');
        const data = await readJson(request);
        if (!plainText(data.title, 70, false) || !plainText(data.body, 150) ||
            typeof data.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId)) {
          fail(400, 'Tiêu đề tối đa 70 ký tự, lời nhắn tối đa 150 ký tự.');
        }
        const key = `manual:${data.requestId}`;
        let message = await env.DB.prepare('SELECT * FROM beo_messages WHERE dedupe_key=?').bind(key).first();
        if (message && (message.title !== data.title || message.body !== data.body)) fail(409, 'Mã gửi đã dùng cho lời nhắn khác.');
        const device = await getReceiver(env);
        if (!device?.push_json) fail(409, 'iPhone chưa bật nhận thông báo. Mở app trên iPhone và kết nối trước nhé.');
        if (message && message.device_id !== device.id) return json({ ok: message.status !== 'failed', message: exposeMessage(message) });
        if (!message) {
          await rateLimit(env, 'send', 10, 60, timestamp);
          message = await createMessage(env, device, { title: data.title, body: data.body, source: 'manual', dedupeKey: key }, timestamp);
          // Another concurrent request may have won INSERT OR IGNORE with different content.
          if (message.title !== data.title || message.body !== data.body || message.device_id !== device.id) {
            fail(409, 'Mã gửi đã dùng cho lời nhắn khác.');
          }
        }
        const result = await deliver(env, device, message, timestamp);
        return json({ ok: result.status !== 'failed', message: exposeMessage(result) }, result.status === 'sending' ? 202 : 200);
      }
      fail(404, 'Không tìm thấy chức năng admin.');
    }
    if (path.startsWith('/api/device/')) {
      const device = await authDevice(request, env);
      if (path === '/api/device/me' && method === 'GET') {
        const settings = await getSettings(env);
        await env.DB.prepare('UPDATE beo_receiver SET last_seen_at=? WHERE id=1 AND device_id=?').bind(timestamp, device.id).run();
        const latest = await env.DB.prepare(`SELECT * FROM beo_messages WHERE device_id=? AND status IN ('accepted','received','opened')
          ORDER BY created_at DESC,id DESC LIMIT 1`).bind(device.id).first();
        return json({ profile: { recipientName: settings.recipient_name, appTitle: settings.app_title, homeMessage: settings.home_message },
          pushEnabled: Boolean(device.push_json), scheduleEnabled: Boolean(settings.schedule_enabled), latestMessage: exposeMessage(latest) });
      }
      const requestedMessage = /^\/api\/device\/messages\/([a-f0-9-]{36})$/.exec(path);
      if (requestedMessage && method === 'GET') {
        const message = await env.DB.prepare('SELECT id,title,body,created_at FROM beo_messages WHERE id=? AND device_id=?')
          .bind(requestedMessage[1], device.id).first();
        if (!message) fail(404, 'Không tìm thấy lời nhắn.');
        return json({ message: { id: message.id, title: message.title, body: message.body, createdAt: message.created_at } });
      }
      if (path === '/api/device/subscribe' && method === 'POST') {
        const data = await readJson(request);
        if (!validPushSubscription(data.subscription)) fail(400, 'Kết nối thông báo không hợp lệ.');
        await env.DB.prepare('UPDATE devices SET push_json=?,push_endpoint=? WHERE id=?')
          .bind(JSON.stringify(data.subscription), data.subscription.endpoint, device.id).run();
        await env.DB.prepare('UPDATE beo_receiver SET last_seen_at=? WHERE id=1 AND device_id=?').bind(timestamp, device.id).run();
        return json({ ok: true });
      }
      if (path === '/api/device/unsubscribe' && method === 'POST') {
        await env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=?').bind(device.id).run();
        return json({ ok: true });
      }
      if (['/api/device/message', '/api/device/schedule', '/api/device/test-push', '/api/device/disconnect'].includes(path)) {
        fail(403, 'Chỉ admin được thay đổi cài đặt và gửi thông báo.');
      }
    }
    fail(404, 'Không tìm thấy chức năng.');
  }

  async function scheduled(event, env) {
    if (!configured(env) || !(await schemaReady(env))) return;
    const date = new Date(event.scheduledTime || now());
    const timestamp = seconds(); // Lease/retry clocks use invocation time, never a delayed cron event time.
    await env.DB.prepare(`UPDATE beo_messages SET status='failed',next_attempt_at=0,lease_until=0,error='Đã hết thời gian thử gửi. Hãy kiểm tra kết nối iPhone.'
      WHERE (status IN ('pending','sending') AND (created_at<? OR (attempts>=? AND lease_until<?)))
      OR (status='failed' AND next_attempt_at>0 AND created_at<?)` )
      .bind(timestamp - RETRY_SECONDS, MAX_ATTEMPTS, timestamp, timestamp - RETRY_SECONDS).run();
    const [settings, device] = await Promise.all([getSettings(env), getReceiver(env)]);
    if (device?.push_json) {
      const slot = latestDueSlot(settings, device, date);
      if (slot && slot !== device.last_sent_slot) {
        const defaults = (settings.notification_title === 'Water ♡' &&
          ['Beo ơi, nhớ nhấp một chút nước nha em ♡', 'Beo ơi, nhớ uống nước nha em ♡'].includes(settings.reminder_message)) ||
          (settings.notification_title === 'Beo ơi 💧' && settings.reminder_message === 'Đến giờ uống nước rồi nè em.');
        // Saved personalized copy remains untouched; only shipped defaults rotate.
        const copy = defaults
          ? { title: selectReminderTitle(slot, settings.interval_minutes), body: selectReminderMessage({ ...device, timezone: settings.timezone, start_time: settings.start_time, end_time: settings.end_time, interval_minutes: settings.interval_minutes, note_to_partner: '' }, { slot }) }
          : { title: settings.notification_title, body: settings.reminder_message };
        const message = await createMessage(env, device, { ...copy,
          source: 'scheduled', dedupeKey: `scheduled:${device.id}:${slot}` }, timestamp);
        await deliver(env, device, message, timestamp);
      }
      if (await routinesReady(env)) {
        const extras = await env.DB.prepare('SELECT * FROM beo_routines WHERE enabled=1 ORDER BY time_local,id').all();
        for (const row of extras.results) {
          const reminder = exposeRoutine(row);
          let matched = null;
          for (let offset=0; offset<15; offset++) {
            matched = routineSlot(reminder,new Date(date.getTime()-offset*60000),settings.timezone);
            if (matched) break;
          }
          if (!matched) continue;
          const message = await createMessage(env,device,{
            title:reminder.title,body:reminder.body,source:'scheduled',
            dedupeKey:'routine:' + device.id + ':' + reminder.id + ':' + matched },timestamp);
          await deliver(env,device,message,timestamp);
        }
      }
      const extrasEnabled = await routinesReady(env) && Boolean((await env.DB.prepare('SELECT id FROM beo_routines WHERE enabled=1 LIMIT 1').first()));
      const retries = await env.DB.prepare(`SELECT * FROM beo_messages WHERE device_id=? AND created_at>=? AND attempts<?
        AND (source='manual' OR ?=1 OR (source='scheduled' AND dedupe_key LIKE 'routine:%' AND ?=1))
        AND (status='pending' OR (status='failed' AND next_attempt_at>0 AND next_attempt_at<=?) OR (status='sending' AND lease_until<?)) ORDER BY created_at LIMIT 5`)
        .bind(device.id, timestamp - RETRY_SECONDS, MAX_ATTEMPTS, settings.schedule_enabled ? 1 : 0, extrasEnabled ? 1 : 0, timestamp, timestamp).all();
      for (const message of retries.results) await deliver(env, device, message, timestamp);
    }
    if (date.getUTCMinutes() === 0) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM beo_admin_sessions WHERE expires_at<=?').bind(timestamp),
        env.DB.prepare('DELETE FROM beo_rate_limits WHERE expires_at<=?').bind(timestamp),
        env.DB.prepare('DELETE FROM beo_messages WHERE created_at<?').bind(timestamp - 30 * 86400)
      ]);
    }
  }
  return {
    async fetch(request, env) {
      const origin = request.headers.get('Origin');
      if (origin && origin !== ORIGIN) return json({ error: 'Origin not allowed' }, 403);
      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
      try { return cors(await route(request, env), origin); }
      catch (error) {
        const status = error instanceof HttpError ? error.status : 500;
        if (status === 500) console.error('Notification backend request failed');
        return cors(json({ error: status === 500 ? 'Máy chủ gặp lỗi. Thử lại sau nhé.' : error.message }, status), origin);
      }
    },
    scheduled
  };
}
export default createWorker();
