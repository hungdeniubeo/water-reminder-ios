import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseTime, makeTime, setupTimePickers } from '../time-picker.js';

test('time picker validates exact 24-hour values and keeps minutes', () => {
  assert.deepEqual(parseTime('08:00'), {hour:8,minute:0});
  assert.deepEqual(parseTime('11:50'), {hour:11,minute:50});
  for (const bad of ['8:00','24:00','12:60','08:0','09:90','']) assert.equal(parseTime(bad),null);
  assert.equal(makeTime(8,0),'08:00');
  assert.equal(makeTime('11','50'),'11:50');
  for (const [h,m] of [[24,0],[-1,0],[8,60],[8,-1],[8,1.5]]) assert.equal(makeTime(h,m),null);
});

test('time-picker enhancement is safe without a browser and keeps native inputs as the saved values', async () => {
  assert.equal(typeof setupTimePickers({}).sync,'function');
  const html=await readFile(new URL('../admin.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../admin.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../admin.css',import.meta.url),'utf8');
  for (const id of ['schedule-start','schedule-end','routine-time']) {
    assert.match(html,new RegExp('id="'+id+'"[^>]+type="time"|type="time"[^>]+id="'+id+'"'));
    assert.match(js,new RegExp('timePickers\\.sync|setupTimePickers'));
  }
  assert.match(css,/\.time-picker-panel/);
  assert.match(css,/\.time-source-hidden/);
  assert.match(js,/onFormOpen:/);
});
