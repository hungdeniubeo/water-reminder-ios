import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverClient, decodeVapidPublicKey, readDeviceSession, receiverScreen, SESSION_KEY } from '../receiver.js';

const session = { id: 'original-device', secret: 'original-device-secret' };
const storage = { getItem: key => key === SESSION_KEY ? JSON.stringify(session) : null };
const ready = { online: true, supported: true, config: { apiVersion: 2, ready: true },
  session, registration: {}, permission: 'granted', subscription: {}, serverPushEnabled: true, verified: true };

test('receiver retains the legacy device session without reactivating or changing the secret', () => {
  assert.deepEqual(readDeviceSession(storage), session);
  assert.equal(readDeviceSession({ getItem: () => '{broken' }), null);
  assert.equal(readDeviceSession({ getItem: () => JSON.stringify({ admin: 'not-a-device' }) }), null);
  assert.equal(readDeviceSession({ getItem: () => { throw new Error('Storage blocked'); } }), null);
});

test('ready means iPhone permission, a local push subscription and successful server registration agree', () => {
  assert.equal(receiverScreen(ready), 'ready');
  for (const patch of [{ subscription: null }, { serverPushEnabled: false }, { verified: false }, { permission: 'default' }]) {
    assert.equal(receiverScreen({ ...ready, ...patch }), 'enable');
  }
  assert.equal(receiverScreen({ ...ready, permission: 'denied' }), 'denied');
  assert.equal(receiverScreen({ ...ready, failed: true }), 'error');
  assert.equal(receiverScreen({ ...ready, online: false }), 'offline');
});

test('iPhone installation, unavailable backend and pairing have distinct one-time setup states', () => {
  assert.equal(receiverScreen({ ...ready, ios: true, standalone: false }), 'install');
  assert.equal(receiverScreen({ ...ready, supported: false }), 'unsupported');
  assert.equal(receiverScreen({ ...ready, config: { ready: true } }), 'server-pending');
  assert.equal(receiverScreen({ ...ready, config: { apiVersion: 2, ready: false } }), 'server-pending');
  assert.equal(receiverScreen({ ...ready, config: null }), 'error');
  assert.equal(receiverScreen({ ...ready, session: null }), 'pair');
});

test('receiver API sends only a device bearer and preserves the subscription payload', async () => {
  const calls = [];
  const client = createReceiverClient({ baseUrl: 'https://notifications.example/', storage,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true }); } });
  const subscription = { endpoint: 'https://web.push.apple.com/example', keys: { auth: 'a', p256dh: 'b' } };
  await client('/api/device/subscribe', { method: 'POST', payload: { subscription } });
  assert.equal(calls[0].url, 'https://notifications.example/api/device/subscribe');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer original-device.original-device-secret');
  assert.deepEqual(JSON.parse(calls[0].init.body), { subscription });
  assert.equal(calls[0].init.cache, 'no-store');
  await client('/api/pair', { method: 'POST', authenticate: false, payload: { code: '12345678' } });
  assert.equal(calls[1].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[1].init.body), { code: '12345678' });
});

test('a rejected registration stays an error rather than looking successfully connected', async () => {
  const client = createReceiverClient({ storage, fetchImpl: async () => Response.json({ error: 'Device expired' }, { status: 401 }) });
  await assert.rejects(client('/api/device/subscribe', { method: 'POST', payload: {} }), error => error.status === 401);
});

test('push key decoding requires an uncompressed P-256 public key', () => {
  const bytes = new Uint8Array(65); bytes[0] = 4;
  const key = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  assert.deepEqual(decodeVapidPublicKey(key), bytes);
  for (const bad of ['', 'bad$key', 'AAAA', undefined]) assert.throws(() => decodeVapidPublicKey(bad));
});

test('real receiver flow clears stale registration, requests permission in the click, and opens the exact clicked message', async () => {
  const { startReceiver } = await import('../receiver.js');
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const originals = new Map();
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  const node = () => ({ hidden: false, disabled: false, textContent: '', value: '', dataset: {}, open: false,
    listeners: {}, addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
    focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
    querySelectorAll() { return []; }, getBoundingClientRect() { return { left: 0, right: 300, top: 0, bottom: 500 }; } });
  const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], node()]));
  const data = new Map([[SESSION_KEY, JSON.stringify(session)]]);
  const apiCalls = [], order = [], swListeners = {};
  const bytes = new Uint8Array(65); bytes[0] = 4;
  const key = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  let savedSubscription = null, serverSubscribed = true;
  let finishMe = null;
  let blockMe = false;
  const subscription = { toJSON: () => ({ endpoint: 'https://web.push.apple.com/test', keys: { auth: 'a', p256dh: 'b' } }) };
  const registration = { active: {}, pushManager: {
    getSubscription: async () => savedSubscription,
    subscribe: async () => { order.push('subscribe'); savedSubscription = subscription; return subscription; }
  } };
  const notification = { permission: 'default', requestPermission() { order.push('permission'); this.permission = 'granted'; return Promise.resolve('granted'); } };
  try {
    install('localStorage', { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) });
    install('window', globalThis);
    install('addEventListener', () => {});
    install('document', { getElementById: id => nodes[id], body: { dataset: {} }, addEventListener() {}, visibilityState: 'visible' });
    install('location', new URL('https://hungdeniubeo.github.io/water-reminder-ios/'));
    install('history', { replaceState() {} });
    install('matchMedia', query => ({ matches: query.includes('reduced-motion') }));
    install('Notification', notification);
    install('PushManager', class {});
    install('navigator', { userAgent: 'iPhone', platform: 'iPhone', standalone: true, onLine: true,
      serviceWorker: { register: async () => registration, ready: Promise.resolve(registration),
        addEventListener(type, listener) { swListeners[type] = listener; } } });
    install('fetch', async (url, options) => {
      const path = new URL(url).pathname;
      apiCalls.push(path);
      if (path === '/api/config') return Response.json({ apiVersion: 2, ready: true, vapidPublicKey: key });
      if (path === '/api/device/me') {
        if (blockMe) { blockMe = false; await new Promise(resolve => { finishMe = resolve; }); }
        return Response.json({ profile: { recipientName: 'Beo', appTitle: 'Water ♡', homeMessage: 'A little note' },
          pushEnabled: serverSubscribed, latestMessage: { id: 'new-message', title: 'New note', body: 'Newer body', createdAt: 1795172400 } });
      }
      if (path === '/api/device/subscribe') { serverSubscribed = true; return Response.json({ ok: true }); }
      if (path === '/api/device/unsubscribe') { serverSubscribed = false; return Response.json({ ok: true }); }
      if (path === '/api/device/messages/older-message') return Response.json({ message: { id: 'older-message', title: 'Older note', body: '<b>Exact old text</b>', createdAt: 1795172300 } });
      throw new Error(`Unexpected request ${path}`);
    });
    const tickUntil = async predicate => {
      for (let i = 0; i < 50; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); }
      assert.ok(predicate(), 'receiver async flow completed');
    };
    const receiver = startReceiver();
    await tickUntil(() => !receiver.state.loading);
    assert.equal(apiCalls.filter(path => path === '/api/device/unsubscribe').length, 1, 'stale server registration is removed');
    assert.equal(nodes['connection-state'].dataset.state, 'enable');
    nodes['enable-button'].listeners.click[0]();
    assert.deepEqual(order, ['permission'], 'consent begins synchronously in the click before subscription/network awaits');
    await tickUntil(() => !receiver.state.busy);
    assert.deepEqual(order, ['permission', 'subscribe']);
    assert.equal(nodes['connection-state'].dataset.state, 'ready');
    const firstNote = nodes['quiet-note'].textContent;
    assert.ok(firstNote.length > 6);
    nodes['letter-button'].listeners.click[0]({ detail: 0 });
    assert.notEqual(nodes['quiet-note'].textContent, firstNote, 'keyboard activation changes the note');
    const secondNote = nodes['quiet-note'].textContent;
    nodes['letter-button'].listeners.pointerdown[0]({ pointerType: 'touch', pointerId: 1 });
    assert.notEqual(nodes['quiet-note'].textContent, secondNote, 'touch changes note immediately');
    const thirdNote = nodes['quiet-note'].textContent;
    nodes['letter-button'].listeners.pointerup[0]();
    nodes['letter-button'].listeners.click[0]({ detail: 1 });
    assert.equal(nodes['quiet-note'].textContent, thirdNote, 'a touch plus click must change only once');
    assert.equal(nodes['letter-dialog'].open, false, 'tapping the drop must never open a dialog');
    blockMe = true;
    const refresh = receiver.refresh();
    await tickUntil(() => !!finishMe);
    swListeners.message({ data: { type: 'NOTIFICATION_OPENED', id: 'older-message' } });
    finishMe();
    await refresh;
    await tickUntil(() => !receiver.state.refreshing);
    assert.equal(nodes['letter-dialog'].open, true, 'click received during refresh is not lost');
    assert.equal(nodes['letter-title'].textContent, 'Older note');
    assert.equal(nodes['letter-body'].textContent, '<b>Exact old text</b>');
    assert.equal(apiCalls.some(path => path.startsWith('/api/admin/') || path.includes('test-push')), false, 'receiver cannot send or edit admin settings');
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});


test('holding the water drop repeats tiny splashes but stops immediately on release', async () => {
  const { attachClassicPinkButton } = await import('../classic-pink-button.js');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousMatchMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const previousAddListener = Object.getOwnPropertyDescriptor(globalThis, 'addEventListener');
  const particles = [];
  let appended = 0;
  const makeParticle = () => ({
    style: { setProperty() {} },
    setAttribute() {}, addEventListener() {},
    remove() { const index = particles.indexOf(this); if (index >= 0) particles.splice(index, 1); }
  });
  const button = {
    disabled: false, offsetWidth: 92, classList: { add() {}, remove() {} },
    listeners: {}, addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
    querySelectorAll() { return particles.slice(); },
    append(node) { appended++; particles.push(node); },
    setPointerCapture() {}
  };
  try {
    Object.defineProperty(globalThis, 'document', { value: { hidden: false, addEventListener() {}, createElement: makeParticle }, configurable: true });
    Object.defineProperty(globalThis, 'matchMedia', { value: () => ({ matches: false }), configurable: true });
    Object.defineProperty(globalThis, 'addEventListener', { value: () => {}, configurable: true });
    attachClassicPinkButton(button);
    button.listeners.pointerdown[0]({ pointerType: 'touch', pointerId: 1 });
    const first = appended;
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(appended > first, 'holding should create multiple splash waves');
    assert.ok(particles.length <= 64, 'particles stay bounded for mobile performance');
    button.listeners.pointerup[0]();
    button.listeners.click[0]({ detail: 1 });
    const stopped = appended;
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(appended, stopped, 'no new droplets appear after release');
  } finally {
    for (const [name, descriptor] of [['document', previousDocument], ['matchMedia', previousMatchMedia], ['addEventListener', previousAddListener]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});


test('receiver home keeps the water button as the only decorative interaction and preserves real notification dialog', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../receiver.css', import.meta.url), 'utf8');
  assert.match(html, /class="water-card"/);
  assert.match(html, /class="water-surface" aria-hidden="true"/);
  assert.match(html, /class="floating-drop floating-drop-one" aria-hidden="true"/);
  assert.match(html, /id="letter-button"[^>]*aria-label="Chạm hoặc giữ/);
  assert.doesNotMatch(html, /id="letter-button"[^>]*aria-haspopup/);
  assert.match(html, /id="letter-dialog"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/admin\.html"/);
});

test('50 gentle water reminders are unique and cycle without repeats when tapping rapidly', async () => {
  const { WATER_NOTES, createWaterNotePicker } = await import('../water-notes.js');
  assert.equal(WATER_NOTES.length, 50);
  assert.equal(new Set(WATER_NOTES).size, 50);
  assert.ok(WATER_NOTES.every(note => note.length > 8 && note.length < 100 && !note.includes('\n')));
  const next = createWaterNotePicker(() => 0.42);
  const firstRound = Array.from({ length: 50 }, next);
  assert.equal(new Set(firstRound).size, 50, 'no duplicate note until all 50 appear');
  assert.equal(firstRound[0] !== next(), true, 'first note next round must not equal previous');
  const another = createWaterNotePicker(() => 0.9);
  const rounds = Array.from({ length: 101 }, another);
  assert.ok(rounds.every((message, index) => index === 0 || message !== rounds[index - 1]));
});

test('touching the drop invokes note change once, holding does not flood the text', async () => {
  const { attachClassicPinkButton } = await import('../classic-pink-button.js');
  const button = { disabled: false, listeners: {},
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
    setPointerCapture() {}
  };
  const oldMatch = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const oldWindowListener = Object.getOwnPropertyDescriptor(globalThis, 'addEventListener');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({matches: true}) });
    Object.defineProperty(globalThis, 'addEventListener', { configurable: true, value: () => {} });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {hidden: false, addEventListener() {}} });
    let count = 0;
    attachClassicPinkButton(button, () => count++);
    button.listeners.pointerdown[0]({pointerType:'touch',pointerId:1});
    assert.equal(count,1,'touch starts one note');
    button.listeners.pointerup[0]();
    button.listeners.click[0]({detail:1});
    assert.equal(count,1,'touch-generated click should not double-fire');
    button.listeners.click[0]({detail:0});
    assert.equal(count,2,'keyboard click changes the note');
    button.listeners.pointerdown[0]({pointerType:'touch',pointerId:2});
    assert.equal(count,3,'another touch changes again');
  } finally {
    for (const [key, descriptor] of [['matchMedia',oldMatch],['addEventListener',oldWindowListener],['document',oldDocument]]) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
});
