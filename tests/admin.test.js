import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_COPIES } from '../water-notes.js';
import {messageState} from '../admin.js';
import {readFile} from 'node:fs/promises';

test('admin never turns provider acceptance into a claim of phone receipt', () => {
  assert.deepEqual(messageState({status:'accepted',acceptedAt:100}),{label:'Đã chuyển đi',tone:'accepted'});
  assert.deepEqual(messageState({status:'received',receivedAt:101}),{label:'iPhone đã nhận',tone:'received'});
  assert.deepEqual(messageState({status:'opened',receivedAt:101,openedAt:102}),{label:'Đã mở',tone:'opened'});
});
test('admin distinguishes retryable failures, terminal failures and queued sends', () => {
  assert.equal(messageState({status:'failed',retryAt:100}).label,'Sẽ thử lại');
  assert.equal(messageState({status:'failed',retryAt:null}).label,'Gửi chưa được');
  assert.equal(messageState({status:'sending'}).label,'Đang gửi');
  assert.equal(messageState({status:'pending'}).label,'Đang gửi');
  assert.equal(messageState({status:'accepted',openedAt:102}).label,'Đã mở');
});
test('receiver and admin have distinct entry points, with all active assets present', async () => {
  const home=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const admin=await readFile(new URL('../admin.html',import.meta.url),'utf8');
  assert.ok(home.includes('receiver.js'));
  assert.ok(home.includes('classic-pink-button.css'));
  assert.equal(/(?:href|src)="\.\/(?:admin|app|styles|logic|journal)/.test(home),false);
  assert.ok(admin.includes('admin.js'));
  assert.ok(admin.includes('type="password"'));
  for (const source of [home,admin]) {
    for(const match of source.matchAll(/(?:src|href)="(\.\/[^"?#]+\.(?:js|css|svg|webmanifest))(?:[?#][^"]*)?"/g)) {
      assert.ok((await readFile(new URL('../'+match[1].slice(2),import.meta.url))).length,match[1]);
    }
  }
});

// Exercise the production event handlers without a browser or any real API call.
async function withAdminHarness(run) {
  const { startAdmin } = await import('../admin.js');
  const html = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
  const originals = new Map();
  const install = (name, value) => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };
  const createNode = () => {
    const node = {
      hidden: false, disabled: false, value: '', checked: false, type: 'text', textContent: '',
      dataset: {}, children: [], listeners: {}, classList: { toggle() {} },
      addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
      setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      reportValidity() { return true; }, reset() {}
    };
    Object.defineProperty(node, 'innerHTML', { set() { throw new Error('Dynamic text must not use innerHTML'); } });
    return node;
  };
  const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], createNode()]));
  const settingFields = {};
  for (const tag of html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
    const id = /\bid="([^"]+)"/.exec(tag[0])?.[1];
    const name = /\bname="([^"]+)"/.exec(tag[0])?.[1];
    if (id && name) settingFields[name] = nodes[id];
    if (id) nodes[id].type = /\btype="([^"]+)"/.exec(tag[0])?.[1] || 'text';
  }
  nodes['settings-form'].elements = { namedItem: name => settingFields[name] || null };
  nodes['settings-form'].reset = () => { for (const node of Object.values(settingFields)) { node.value = ''; node.checked = false; } };
  nodes['send-form'].reset = () => { nodes['send-title'].value = ''; nodes['send-body'].value = ''; };
  nodes.dashboard.hidden = true;
  nodes.logout.hidden = true;
  const storage = new Map(), storageWrites = [], calls = [], intervals = [];
  const password = 'test-owner-code-never-persist-this';
  const bearer = 'admin.test-session.test-session-secret';
  const state = {
    settings: { recipientName: 'Beo', appTitle: 'Water ♡', homeMessage: 'Một chút thương ♡',
      notificationTitle: 'Water ♡', reminderMessage: 'Beo ơi, uống nước nha ♡',
      enabled: true, start: '09:00', end: '21:00', interval: 120, timezone: 'Asia/Ho_Chi_Minh' },
    device: { paired: true, pushEnabled: true }, service: { ready: true }, messages: []
  };
  let failSends = 0;
  let nextStateGate = null;
  const gates = [];
  const tickUntil = async predicate => {
    for (let i = 0; i < 60; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); }
    assert.ok(predicate(), 'admin async event flow completed');
  };
  const emit = (id, type) => Promise.all((nodes[id].listeners[type] || []).map(listener => listener({ preventDefault() {} })));
  try {
    install('sessionStorage', {
      getItem: name => storage.get(name) ?? null,
      setItem: (name, value) => { storageWrites.push({ name, value }); storage.set(name, value); },
      removeItem: name => storage.delete(name)
    });
    install('localStorage', { setItem() { throw new Error('Admin credentials must not enter localStorage'); }, getItem() { return null; } });
    install('document', { getElementById: id => nodes[id], hidden: false, addEventListener() {},
      createElement: createNode, createDocumentFragment: createNode });
    install('window', { confirm: () => true });
    install('setInterval', callback => { intervals.push(callback); return intervals.length; });
    install('fetch', async (url, options) => {
      const path = new URL(url).pathname;
      const data = options.body === undefined ? undefined : JSON.parse(options.body);
      calls.push({ path, data, headers: { ...options.headers }, credentials: options.credentials });
      if (path === '/api/config') return Response.json({ apiVersion: 2, ready: true });
      if (path === '/api/admin/login') {
        assert.equal(data.code, password);
        return Response.json({ token: bearer, expiresAt: 1796000000 });
      }
      if (path === '/api/admin/state') {
        const gate = nextStateGate;
        nextStateGate = null;
        if (gate) { gate.started = true; await gate.promise; }
        return Response.json(state);
      }
      if (path === '/api/admin/routines') return Response.json({routines: [], advanced: true});
      if (path === '/api/admin/send') {
        if (failSends > 0) { failSends--; throw new TypeError('Network connection lost after request was sent'); }
        const message = { id: 'sent-message', title: data.title, body: data.body,
          source: 'manual', status: 'accepted', createdAt: 1795172400, acceptedAt: 1795172401 };
        state.messages = [message];
        return Response.json({ ok: true, message });
      }
      if (path === '/api/admin/logout') return Response.json({ ok: true });
      throw new Error(`Unexpected API call: ${path}`);
    });
    const app = startAdmin();
    await tickUntil(() => !nodes['login-button'].disabled && nodes['login-button'].textContent === 'Vào trang quản trị');
    const login = async () => {
      nodes['admin-code'].value = password;
      await emit('login-form', 'submit');
      assert.equal(nodes.dashboard.hidden, false);
    };
    await run({ nodes, storage, storageWrites, calls, state, password, bearer, app, login, emit, tickUntil, intervals,
      failNextSend() { failSends++; },
      deferNextState() {
        const gate = { started: false };
        gate.promise = new Promise(resolve => { gate.resolve = resolve; });
        nextStateGate = gate; gates.push(gate); return gate;
      }
    });
  } finally {
    for (const gate of gates) gate.resolve();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test('admin login stores only the returned session bearer and renders custom notification text safely', async () => {
  await withAdminHarness(async ({ nodes, storage, storageWrites, calls, login, emit, password, bearer }) => {
    await login();
    assert.equal(nodes['admin-code'].value, '', 'password field is cleared after login');
    assert.deepEqual([...storage.entries()], [['water-admin-session-v2', bearer]]);
    assert.equal(storageWrites.some(write => write.value.includes(password)), false, 'password is never persisted');
    const loginCall = calls.find(call => call.path === '/api/admin/login');
    assert.equal(loginCall.headers.Authorization, undefined);
    const stateCall = calls.find(call => call.path === '/api/admin/state');
    assert.equal(stateCall.headers.Authorization, `Bearer ${bearer}`);
    assert.equal(stateCall.credentials, 'omit');
    const title = 'Beo <3 ♡';
    const body = '<img src=x onerror=alert(1)> là chữ thôi. Beo uống nước nha ♡';
    nodes['send-title'].value = title;
    nodes['send-body'].value = body;
    await emit('send-title', 'input');
    await emit('send-body', 'input');
    assert.equal(nodes['preview-title'].textContent, title);
    assert.equal(nodes['preview-body'].textContent, body);
    assert.equal(nodes['send-count'].textContent, `${body.length} / 150`);
    await emit('send-form', 'submit');
    const send = calls.find(call => call.path === '/api/admin/send');
    assert.equal(send.data.title, title);
    assert.equal(send.data.body, body);
    assert.equal(send.headers.Authorization, `Bearer ${bearer}`);
    assert.match(send.data.requestId, /^[a-f0-9-]{36}$/);
    assert.match(nodes['send-status'].textContent, /Đang chờ phản hồi từ iPhone/);
    assert.equal(nodes['send-status'].textContent.includes('iPhone đã nhận'), false);
  });
});

test('an ambiguous network failure retries the same custom message with the same idempotency key', async () => {
  await withAdminHarness(async ({ nodes, calls, login, emit, failNextSend }) => {
    await login();
    nodes['send-title'].value = 'Lời nhắn riêng ♡';
    nodes['send-body'].value = 'Cục zàng nhớ uống nước nha em.';
    await emit('send-body', 'input');
    failNextSend();
    await emit('send-form', 'submit');
    assert.equal(nodes['send-button'].disabled, false, 'send can be retried after a network failure');
    assert.equal(nodes['send-status'].dataset.tone, 'error');
    await emit('send-form', 'submit');
    const sends = calls.filter(call => call.path === '/api/admin/send');
    assert.equal(sends.length, 2);
    assert.deepEqual(sends[1].data, sends[0].data, 'request ID and content survive an unknown delivery outcome');
  });
});

test('background polling updates device data without replacing unsaved settings or the send draft', async () => {
  await withAdminHarness(async ({ nodes, state, login, emit, tickUntil, intervals }) => {
    await login();
    nodes['recipient-name'].value = 'Beo đang sửa';
    nodes['reminder-body'].value = 'Lời nhắc chưa lưu';
    await emit('settings-form', 'input');
    nodes['send-title'].value = 'Tiêu đề đang viết';
    nodes['send-body'].value = 'Lời nhắn chưa gửi';
    await emit('send-body', 'input');
    state.settings.recipientName = 'Beo trên máy chủ';
    state.settings.reminderMessage = 'Nội dung cũ từ máy chủ';
    state.device.pushEnabled = false;
    assert.equal(intervals.length, 1);
    intervals[0]();
    await tickUntil(() => nodes['heading-name'].textContent === 'Beo trên máy chủ');
    assert.equal(nodes['recipient-name'].value, 'Beo đang sửa');
    assert.equal(nodes['reminder-body'].value, 'Lời nhắc chưa lưu');
    assert.equal(nodes['send-title'].value, 'Tiêu đề đang viết');
    assert.equal(nodes['send-body'].value, 'Lời nhắn chưa gửi');
    assert.equal(nodes['send-button'].disabled, true, 'live device status still disables sending');
  });
});

test('notification templates only edit drafts and preserve pending edits during refresh', async () => {
  await withAdminHarness(async ({ nodes, state, calls, login, emit, app }) => {
    await login();
    const savedSettings = structuredClone(state.settings);
    await emit('use-send-template', 'click');
    const copy = HOME_COPIES.find(item => item.title.toLocaleUpperCase('vi-VN') === nodes['send-title'].value);
    assert.ok(copy, 'manual template is one of the rotating Beo greetings');
    assert.equal(nodes['send-body'].value, copy.body);
    assert.equal(nodes['preview-title'].textContent, nodes['send-title'].value);
    assert.equal(nodes['preview-body'].textContent, nodes['send-body'].value);
    nodes['reminder-mode'].value = 'auto';
    await emit('reminder-mode', 'change');
    await app.refreshState({ silent: true });
    assert.equal(nodes['custom-copy-fields'].hidden, true);
    assert.equal(nodes['reminder-mode'].value, 'auto');
    assert.deepEqual(state.settings, savedSettings, 'switching mode does not silently change saved schedules');
    assert.equal(calls.some(call => ['/api/admin/send', '/api/admin/settings'].includes(call.path)), false,
      'choosing a template or auto mode must not send or save automatically');
  });
});

test('only the exact shipped notification pair is refreshed in the initial send draft', async () => {
  for (const body of ['Beo ơi, nhớ nhấp một chút nước nha em ♡', 'Beo ơi, đây là lời nhắn riêng ♡']) {
    await withAdminHarness(async ({ nodes, state, login }) => {
      state.settings.notificationTitle = 'Water ♡';
      state.settings.reminderMessage = body;
      await login();
      const builtIn = body === 'Beo ơi, nhớ nhấp một chút nước nha em ♡';
      if (builtIn) {
        const template = HOME_COPIES.find(item => item.title.toLocaleUpperCase('vi-VN') === nodes['send-title'].value);
        assert.ok(template, 'built-in preset loads a fresh sample');
        assert.equal(nodes['send-body'].value, template.body);
      } else {
        assert.equal(nodes['send-title'].value, 'Water ♡');
        assert.equal(nodes['send-body'].value, body);
      }
      assert.equal(nodes['reminder-title'].value, 'Water ♡', 'stored schedule stays visible as saved');
      assert.equal(nodes['reminder-body'].value, body);
    });
  }
});

test('a state response arriving after logout cannot reopen the dashboard or restore credentials', async () => {
  await withAdminHarness(async ({ nodes, storage, app, login, emit, tickUntil, deferNextState }) => {
    await login();
    const gate = deferNextState();
    const lateRefresh = app.refreshState({ silent: true });
    await tickUntil(() => gate.started);
    await emit('logout', 'click');
    assert.equal(nodes.dashboard.hidden, true);
    assert.equal(nodes['login-panel'].hidden, false);
    assert.equal(storage.has('water-admin-session-v2'), false);
    gate.resolve();
    await lateRefresh;
    assert.equal(nodes.dashboard.hidden, true);
    assert.equal(nodes.logout.hidden, true);
    assert.equal(nodes['login-panel'].hidden, false);
    assert.equal(storage.has('water-admin-session-v2'), false);
    assert.equal(nodes['send-title'].value, '');
    assert.equal(nodes['send-body'].value, '');
  });
});

test('phone draft follows typing and live preview follows only real receipt states', async()=>{
  await withAdminHarness(async({nodes,state,login,emit,app,intervals,tickUntil})=>{
    await login();
    assert.equal(nodes['phone-live-tab'].attributes['aria-pressed'],'true');
    assert.equal(nodes['phone-live-notification'].hidden,true);
    nodes['send-title'].value='Nhắc Beo ♡';nodes['send-body'].value='Nội dung mới';
    await emit('send-title','input');await emit('send-body','input');
    assert.equal(nodes['phone-draft-panel'].hidden,false);
    assert.equal(nodes['phone-delivery'].dataset.tone,'draft');
    assert.equal(nodes['preview-body'].textContent,'Nội dung mới');
    await emit('send-form','submit');
    assert.equal(nodes['phone-live-panel'].hidden,false);
    assert.equal(nodes['phone-live-title'].textContent,'Nhắc Beo ♡');
    assert.equal(nodes['phone-live-body'].textContent,'Nội dung mới');
    assert.equal(nodes['phone-delivery'].dataset.tone,'accepted');
    assert.match(nodes['phone-delivery-title'].textContent,/chờ iPhone/);
    assert.doesNotMatch(nodes['phone-delivery-title'].textContent,/iPhone đã nhận/);
    Object.assign(state.messages[0],{status:'received',receivedAt:1795172403});
    intervals[0]();
    await tickUntil(()=>nodes['phone-delivery'].dataset.tone==='received');
    assert.equal(nodes['phone-delivery-title'].textContent,'iPhone đã nhận');
    assert.equal(nodes['send-status'].textContent,'iPhone đã nhận');
    // The draft does not change when a receipt or new scheduled notification arrives.
    Object.assign(state.messages[0],{status:'opened',openedAt:1795172404});
    await app.refreshState({silent:true});
    assert.equal(nodes['phone-delivery-title'].textContent,'Đã mở');
    state.messages.unshift({id:'scheduled-message',title:'Nghỉ mắt',body:'Nghỉ tay nha',source:'scheduled',status:'received',createdAt:1795172500,receivedAt:1795172501});
    await app.refreshState({silent:true});
    assert.equal(nodes['phone-live-title'].textContent,'Nghỉ mắt');
    assert.match(nodes['phone-screen-caption'].textContent,/THEO LỊCH/);
    assert.equal(nodes['send-title'].value,'Nhắc Beo ♡');
    await emit('logout','click');
    assert.equal(nodes['phone-live-notification'].hidden,true);
    assert.equal(nodes['phone-live-body'].textContent,'');
  });
});

test('unknown send outcome never appears as a confirmed iPhone receipt',async()=>{
  await withAdminHarness(async({nodes,login,emit,failNextSend})=>{
    await login();
    nodes['send-title'].value='BEO ♡';nodes['send-body'].value='Nghỉ tay nha';
    await emit('send-body','input');failNextSend();
    await emit('send-form','submit');
    assert.equal(nodes['phone-delivery'].dataset.tone,'unknown');
    assert.equal(nodes['phone-live-body'].textContent,'Nghỉ tay nha');
    assert.match(nodes['phone-delivery-title'].textContent,/Chưa rõ/);
    await emit('send-form','submit');
    assert.equal(nodes['phone-delivery'].dataset.tone,'accepted');
  });
});

test('a newer confirmed scheduled message is visible even if the earlier manual push has no receipt',async()=>{
  await withAdminHarness(async({nodes,state,login,emit,app})=>{
    await login();
    nodes['send-title'].value='Lời nhắn trước';nodes['send-body'].value='Chờ iPhone';
    await emit('send-body','input');await emit('send-form','submit');
    assert.equal(nodes['phone-delivery'].dataset.tone,'accepted');
    state.messages.unshift({id:'newer-scheduled',title:'Uống nước',body:'Nhớ uống nước nhé',source:'scheduled',status:'received',createdAt:1795172500,receivedAt:1795172501});
    await app.refreshState({silent:true});
    assert.equal(nodes['phone-live-title'].textContent,'Uống nước');
    assert.equal(nodes['phone-delivery'].dataset.tone,'received');
    assert.match(nodes['send-status'].textContent,/Đang chờ phản hồi từ iPhone/,'the original manual push is not falsely confirmed');
  });
});
