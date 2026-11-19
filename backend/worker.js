import { buildPushPayload } from '@block65/webcrypto-web-push';
import { dueSlot, goodNote, goodSchedule, localClock, randomSecret, safeCompare, sha256, validPushSubscription } from './lib.js';

// A private one-device reminder backend. Existing water-couple D1 schema is reused.
const ORIGIN = 'https://hungdeniubeo.github.io';
const ROOM_ID = 'water-beo-single-device';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
function cors(response, origin) {
  if (origin !== ORIGIN) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', ORIGIN);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Setup-Key');
  headers.set('Access-Control-Max-Age', '1800');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
async function readJson(request) {
  if (Number(request.headers.get('content-length')) > 7000) fail(413, 'Request too large');
  const data = await request.text();
  if (data.length > 7000) fail(413, 'Request too large');
  try { const result = JSON.parse(data); if (!result || typeof result !== 'object' || Array.isArray(result)) fail(400, 'Expected JSON object'); return result; }
  catch(err) { if (err instanceof HttpError) throw err; fail(400, 'Invalid JSON'); }
}
const seconds = () => Math.floor(Date.now()/1000);
const locale = value => value === 'en' ? 'en' : 'vi';
async function auth(request, env) {
  const match = /^Bearer ([a-f0-9-]{36})\.([a-zA-Z0-9_-]{30,})$/.exec(request.headers.get('Authorization') || '');
  if (!match) fail(401, 'Device not activated');
  const device = await env.DB.prepare('SELECT * FROM devices WHERE id=? AND room_id=?').bind(match[1],ROOM_ID).first();
  if (!device || !safeCompare(device.token_hash,await sha256(match[2]))) fail(401, 'Device activation expired');
  return device;
}
function ready(env) {
  return !!(env.DB && env.VAPID_PUBLIC_KEY && !env.VAPID_PUBLIC_KEY.startsWith('REPLACE') && env.VAPID_PRIVATE_KEY && env.OWNER_SETUP_CODE && env.OWNER_SETUP_CODE.length >= 16);
}
async function notify(env, device) {
  if (!device.push_json) fail(409, 'Turn on notifications first');
  const title = 'Water ♡';
  const body = device.note_to_partner?.trim() || (device.lang === 'en' ? 'Beo, a little water break? ♡' : 'Beo ơi, tới giờ uống nước rồi nè ♡');
  const subscription = JSON.parse(device.push_json);
  const payload = await buildPushPayload({ data: JSON.stringify({ title, body }), options: { ttl: 900 } }, subscription, {
    subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY
  });
  const response = await fetch(subscription.endpoint, payload);
  if (response.status === 404 || response.status === 410) {
    await env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=?').bind(device.id).run();
  }
  return response.status;
}
async function route(request,env) {
  if (!env.DB) fail(503,'Database not configured');
  const {pathname:path}=new URL(request.url);
  const method=request.method;
  if(path==='/api/config' && method==='GET') return json({ready:ready(env),vapidPublicKey:ready(env)?env.VAPID_PUBLIC_KEY:null,mode:'single-device'});
  if(path==='/api/activate' && method==='POST') {
    if(!ready(env)) fail(503,'Notification service not ready');
    const key=request.headers.get('X-Setup-Key')||'';
    if(!key || !safeCompare(await sha256(key),await sha256(env.OWNER_SETUP_CODE))) fail(403,'Incorrect activation code');
    const data=await readJson(request);
    await env.DB.prepare('INSERT OR IGNORE INTO rooms (id,created_at) VALUES (?,?)').bind(ROOM_ID,seconds()).run();
    const id=crypto.randomUUID(),secret=randomSecret(),tokenHash=await sha256(secret);
    const created=await env.DB.prepare(`INSERT INTO devices (id,room_id,token_hash,name,lang,created_at)
      SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM devices WHERE room_id=?)`)
      .bind(id,ROOM_ID,tokenHash,'Beo',locale(data.locale),seconds(),ROOM_ID).run();
    if(!created.meta.changes) fail(409,'This private app already has an activated iPhone');
    return json({device:{id,secret}},201);
  }
  const device=await auth(request,env);
  if(path==='/api/device/me' && method==='GET') return json({activated:true,pushEnabled:!!device.push_json,scheduleEnabled:!!device.reminder_enabled,note:device.note_to_partner||''});
  if(path==='/api/device/schedule' && method==='POST') {
    const data=await readJson(request);
    if(!goodSchedule(data)) fail(400,'Invalid reminder schedule or timezone');
    await env.DB.prepare('UPDATE devices SET reminder_enabled=?,start_time=?,end_time=?,interval_minutes=?,timezone=?,lang=? WHERE id=?')
      .bind(data.enabled?1:0,data.start,data.end,Number(data.interval),data.timezone,locale(data.locale),device.id).run();
    return json({ok:true});
  }
  if(path==='/api/device/message' && method==='POST') {
    const data=await readJson(request);
    if(!goodNote(data.note)) fail(400,'Reminder message is too long');
    await env.DB.prepare('UPDATE devices SET note_to_partner=? WHERE id=?').bind(data.note,device.id).run();
    return json({ok:true});
  }
  if(path==='/api/device/subscribe' && method==='POST') {
    const data=await readJson(request);
    if(!validPushSubscription(data.subscription)) fail(400,'Invalid push subscription');
    await env.DB.prepare('UPDATE devices SET push_json=?,push_endpoint=? WHERE id=?').bind(JSON.stringify(data.subscription),data.subscription.endpoint,device.id).run();
    return json({ok:true});
  }
  if(path==='/api/device/unsubscribe' && method==='POST') {
    await env.DB.prepare('UPDATE devices SET push_json=NULL,push_endpoint=NULL WHERE id=?').bind(device.id).run();return json({ok:true});
  }
  if(path==='/api/device/test-push' && method==='POST') {
    if(!device.push_json) fail(409,'Enable notifications first');
    const last=seconds();
    const updated=await env.DB.prepare('UPDATE devices SET last_test_at=? WHERE id=? AND last_test_at<?')
      .bind(last,device.id,last-120).run();
    if(!updated.meta.changes) fail(429,'Wait 2 minutes before retrying a push test');
    const status=await notify(env,device);
    if(status<200||status>=300) fail(502,`Push endpoint returned ${status}`);
    return json({ok:true});
  }
  if(path==='/api/device/disconnect' && method==='POST') {
    await env.DB.prepare('DELETE FROM devices WHERE id=?').bind(device.id).run();
    return json({ok:true});
  }
  fail(404,'Not found');
}
async function sendScheduled(env,date) {
  if(!env.DB || !ready(env)) return;
  const devices=await env.DB.prepare('SELECT * FROM devices WHERE room_id=? AND reminder_enabled=1 AND push_json IS NOT NULL').bind(ROOM_ID).all();
  for(const device of devices.results||[]) {
    const slot=dueSlot(device,date);
    if(!slot||slot===device.last_sent_slot) continue;
    const changed=await env.DB.prepare('UPDATE devices SET last_sent_slot=? WHERE id=? AND last_sent_slot<>?').bind(slot,device.id,slot).run();
    if(!changed.meta.changes) continue;
    try { const status=await notify(env,device);if(status<200||status>=300)console.error('Push rejected',device.id,status); }
    catch(err) { console.error('Push failed',device.id,err.message); }
  }
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin');
    if(origin && origin!==ORIGIN) return json({error:'Origin not allowed'},403);
    if(request.method==='OPTIONS') return cors(new Response(null,{status:204}),origin);
    try { return cors(await route(request,env),origin); }
    catch(err) { const status=err instanceof HttpError?err.status:500;if(status===500)console.error('Backend error',err);return cors(json({error:status===500?'Internal server error':err.message},status),origin); }
  },
  async scheduled(event,env) { await sendScheduled(env,new Date(event.scheduledTime||Date.now())); }
};