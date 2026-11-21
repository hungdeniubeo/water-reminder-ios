import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setupRoutinesAdmin} from '../routines-admin.js';

test('the slim admin has independently editable daily reminders',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const ids=['routine-list','routine-add','routine-form','routine-time','routine-title',
    'routine-body','routine-delete','routine-enabled','routine-cancel','routine-save'];
  for(const id of ids) assert.match(html,new RegExp('id="'+id+'"'),id);
  assert.equal((html.match(/<section class="card"/g)||[]).length,2);
  assert.equal((html.match(/data-routine-day="/g)||[]).length,7);
  assert.match(html,/id="routine-form"[^>]*hidden/);
});
test('reminder editor starts without sending or saving before an admin click',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[
    x[1],{value:'',textContent:'',hidden:false,listeners:{},dataset:{},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      replaceChildren(){},classList:{toggle(){}},}
  ]));
  const original=globalThis.document;
  globalThis.document={querySelectorAll:()=>[],getElementById:id=>elements[id]};
  let invoked=false;
  try {
    const app=setupRoutinesAdmin({$:id=>elements[id],api:async()=>{invoked=true;return {routines:[]};}});
    assert.equal(typeof app.ensureLoaded,'function');
    assert.equal(invoked,false,'no API calls before signed-in state is loaded');
  } finally {globalThis.document=original;}
});
