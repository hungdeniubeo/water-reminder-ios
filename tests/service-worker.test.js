import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { PUSH_API_URL } from '../push-config.js';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://hungdeniubeo.github.io/water-reminder-ios/';
const id = '11111111-2222-4333-8444-555555555555';
const receiptToken = 'a'.repeat(64);
function worker({windows = [], failReceipt = false} = {}) {
  const handlers = new Map();
  const calls = [];
  const cache = {addAll: async paths => calls.push(['assets', paths]), put: async () => {}, match: async () => new Response('offline home')};
  const context = {
    URL, Request, Response, AbortController, setTimeout, clearTimeout, crypto,
    fetch: async (url, init) => { calls.push(['fetch',url,init]); if (failReceipt) throw new Error('Offline'); return Response.json({ok:true}); },
    caches: {open:async () => cache, keys:async () => ['water-reminder-static-v18-loving-push','unrelated-cache'], delete:async key => { calls.push(['delete',key]); return true; }},
    self: {
      registration:{scope, showNotification:async (title,options) => calls.push(['show',title,options])},
      addEventListener:(event,handler) => handlers.set(event,handler), skipWaiting:async () => {},
      clients:{claim:async () => {}, matchAll:async () => windows, openWindow:async url => calls.push(['open',url])}
    }
  };
  vm.runInNewContext(source, context);
  async function fire(type, extra = {}) {
    let done;
    handlers.get(type)({...extra, waitUntil:promise => { done = promise; }});
    await done;
  }
  return {calls,handlers,fire};
}
test('push displays the exact custom text with system sound requested before requesting a device receipt', async () => {
  const sw = worker();
  await sw.fire('push',{data:{json:() => ({id,title:'Nhớ em ♡',body:'Beo ơi, nghỉ tay một chút nha.',receiptToken})}});
  assert.equal(sw.calls[0][0],'show');
  assert.equal(sw.calls[0][1],'Nhớ em ♡');
  assert.equal(sw.calls[0][2].body,'Beo ơi, nghỉ tay một chút nha.');
  assert.equal(sw.calls[0][2].tag,'water-'+id);
  assert.equal(sw.calls[0][2].silent,false);
  const sent = sw.calls.find(call => call[0] === 'fetch');
  assert.equal(sent[1],PUSH_API_URL+'/api/receipts');
  assert.deepEqual(JSON.parse(sent[2].body),{id,token:receiptToken,event:'received'});
  assert.equal(sent[2].credentials,'omit');
});
test('receipt network failure and malformed old payload cannot suppress notifications', async () => {
  const sw = worker({failReceipt:true});
  await sw.fire('push',{data:{json:() => ({id,title:'Water ♡',body:'Hello',receiptToken})}});
  await sw.fire('push',{data:{json:() => {throw new Error('Bad JSON');}}});
  assert.equal(sw.calls.filter(call => call[0] === 'show').length,2);
  const fallback = sw.calls.filter(call => call[0] === 'show')[1];
  assert.equal(fallback[1],'Beo Daily ♡');
  assert.equal(fallback[2].body,'Beo ơi, anh gửi em một lời nhắc nhỏ ♡');
  assert.equal(fallback[2].silent,false);
  assert.equal(sw.calls.filter(call => call[0] === 'fetch').length,1);
  const tags = sw.calls.filter(call => call[0] === 'show').map(call => call[2].tag);
  assert.notEqual(tags[0],tags[1]);
});
test('notification click opens only the same-origin receiving app, never a supplied payload URL', async () => {
  const sw = worker({windows:[{url:scope+'admin.html',focus:async () => assert.fail('Should not open admin')}]});
  let closed = false;
  await sw.fire('notificationclick',{notification:{close:() => {closed=true;},data:{id,receiptToken,url:'https://unrelated.example/'}}});
  assert.ok(closed);
  assert.equal(sw.calls.find(call => call[0] === 'open')[1],scope+'?message='+id);
  assert.equal(JSON.parse(sw.calls.find(call => call[0] === 'fetch')[2].body).event,'opened');
});
test('existing receiver opens the exact clicked message without sharing receipt credentials with windows', async () => {
  let focused = false;
  const messages=[];
  const sw = worker({windows:[{url:scope,focus:async () => {focused=true;},postMessage:data => messages.push(data)}]});
  await sw.fire('notificationclick',{notification:{close:() => {},data:{id,receiptToken}}});
  assert.ok(focused);
  assert.deepEqual(JSON.parse(JSON.stringify(messages)),[{type:'NOTIFICATION_OPENED',id}]);
  assert.equal(sw.calls.some(call => call[0] === 'open'),false);
});
test('worker caches only receiver assets and leaves admin and API data outside its fetch handler', async () => {
  const sw=worker();
  await sw.fire('install');
  await sw.fire('activate');
  const assets=sw.calls.find(call => call[0] === 'assets')[1];
  assert.ok(assets.some(path => path.startsWith('./receiver.js?v=')));
  assert.ok(assets.some(path => path.startsWith('./classic-pink-button.css?v=')));
  assert.equal(assets.some(path => /admin|app\.js|logic\.js/.test(path)),false);
  for (const url of [scope+'admin.html',scope+'admin.js',PUSH_API_URL+'/api/admin/state']) {
    sw.handlers.get('fetch')({request:new Request(url),respondWith:() => assert.fail('Private admin data must never be cached')});
  }
  assert.ok(sw.calls.some(call => call[0] === 'delete' && call[1] === 'water-reminder-static-v18-loving-push'));
  assert.equal(sw.calls.some(call => call[0] === 'delete' && call[1] === 'unrelated-cache'),false);
});

test('receiver cache precaches the exact updated shell assets',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const sw=worker();await sw.fire('install');
  const assets=sw.calls.find(call=>call[0]==='assets')[1];
  for(const name of ['receiver.js','receiver.css']){
    const url=html.match(new RegExp('(?:src|href)="(\\./'+name.replace('.','\\.')+'\\?v=[^"]+)"'))?.[1];
    assert.ok(url,name);assert.ok(assets.includes(url),url);
    assert.match(url,/touch-fix-v1/);
  }
});
