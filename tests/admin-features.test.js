import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewScheduleTimes, MIN_INTERVAL, MAX_INTERVAL } from '../admin-features.js';

test('custom 5/7/10/15 minute schedules are previewed accurately',()=>{
  assert.equal(MIN_INTERVAL,5);assert.equal(MAX_INTERVAL,720);
  assert.deepEqual(previewScheduleTimes('09:00','09:30',5),['09:00','09:05','09:10','09:15','09:20','09:25','09:30']);
  assert.deepEqual(previewScheduleTimes('09:01','09:30',7),['09:01','09:08','09:15','09:22','09:29']);
  assert.deepEqual(previewScheduleTimes('09:00','09:30',10),['09:00','09:10','09:20','09:30']);
  assert.deepEqual(previewScheduleTimes('09:00','09:45',15),['09:00','09:15','09:30','09:45']);
  assert.deepEqual(previewScheduleTimes('09:00','21:00',720),['09:00','21:00']);
});
test('invalid inputs and overnight ranges do not pass',()=>{
  for (const i of [0,4,5.5,721,-2]) assert.deepEqual(previewScheduleTimes('09:00','21:00',i),[]);
  assert.deepEqual(previewScheduleTimes('21:00','09:00',15),[]);
});
test('minimal admin keeps only essential actions, not large dashboards or CSV controls',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  for(const id of ['schedule-interval','reminder-mode','settings-form','send-form','device-card','message-history','pair-button']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/min="5" max="720" step="1"/);
  assert.doesNotMatch(html,/history-export|history-search|disconnect-button|stat-grid|section-nav/);
});
