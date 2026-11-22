import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewScheduleTimes} from '../admin-features.js';
test('quick presets stay small while accepting custom minute input',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const presets=[...html.matchAll(/data-interval="(\d+)"/g)].map(x=>Number(x[1]));
  assert.deepEqual(presets,[5,10,15,30,60,120]);
  assert.deepEqual(previewScheduleTimes('10:00','10:27',13),['10:00','10:13','10:26']);
});
test('advanced editing and device history remain collapsed initially',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  assert.match(html,/<details class="extra-settings" id="extra-settings">/);
  assert.match(html,/<details class="manage-details" id="device-card">/);
  assert.match(html,/id="routines-section"/);
  assert.match(html,/id="compose-section"/);
});
