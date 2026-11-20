import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewScheduleTimes,MIN_INTERVAL,MAX_INTERVAL} from '../admin-features.js';

test('admin previews 5/7/10/15 minute and custom hourly schedules correctly', () => {
  assert.equal(MIN_INTERVAL,5);
  assert.equal(MAX_INTERVAL,720);
  assert.deepEqual(previewScheduleTimes('09:00','10:00',5),[
    '09:00','09:05','09:10','09:15','09:20','09:25','09:30',
    '09:35','09:40','09:45','09:50','09:55','10:00'
  ]);
  assert.deepEqual(previewScheduleTimes('09:01','09:30',7),['09:01','09:08','09:15','09:22','09:29']);
  assert.deepEqual(previewScheduleTimes('09:00','09:30',10),['09:00','09:10','09:20','09:30']);
  assert.deepEqual(previewScheduleTimes('09:00','09:45',15),['09:00','09:15','09:30','09:45']);
  assert.deepEqual(previewScheduleTimes('09:00','21:00',720),['09:00','21:00']);
});
test('admin rejects invalid minute ranges and never schedules after closing time', () => {
  for(const interval of [0,4,5.5,721,NaN,-1]){
    assert.deepEqual(previewScheduleTimes('09:00','18:00',interval),[]);
  }
  assert.deepEqual(previewScheduleTimes('18:00','09:00',15),[]);
  assert.deepEqual(previewScheduleTimes('09:00','09:00',15),[]);
  assert.deepEqual(previewScheduleTimes('09:00','09:09',15),['09:00']);
});
test('live admin markup exposes each management control and keeps personal text in secure forms',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  for(const id of ['schedule-interval','mode-auto','mode-fixed','schedule-preview-times',
    'history-status','history-search','history-source','history-export','history-prev',
    'history-next','disconnect-button','device-last-seen','use-home-auto']) {
    assert.match(html,new RegExp('id="'+id+'"'),id);
  }
  assert.match(html,/min="5" max="720" step="1"/);
  assert.match(html,/id="schedule-interval" name="interval" type="number"/);
  assert.match(html,/id="reminder-title" name="notificationTitle"/);
  assert.match(html,/id="reminder-body" name="reminderMessage"/);
  assert.match(html,/id="send-form"/);
  assert.match(html,/id="settings-form"/);
});
