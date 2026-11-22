import test from 'node:test';
import assert from 'node:assert/strict';
import { dueSlot, goodSchedule, localClock, safeCompare, randomSecret, validPushSubscription } from './lib.js';

test('timezone conversion preserves local day and minute', () => {
  assert.deepEqual(localClock(new Date('2026-11-19T03:00:00.000Z'), 'Asia/Ho_Chi_Minh'), { day: '2026-11-19', minutes: 600 });
});
test('scheduled reminders respect minute, enabled flag and dedup conditions', () => {
  const device = { reminder_enabled: 1, push_json: '{}', timezone: 'Asia/Ho_Chi_Minh', start_time: '09:00', end_time: '21:00', interval_minutes: 120 };
  assert.equal(dueSlot(device, new Date('2026-11-19T04:00:00Z')), '2026-11-19:660');
  assert.equal(dueSlot(device, new Date('2026-11-19T04:01:00Z')), null);
  assert.equal(dueSlot({ ...device, reminder_enabled: 0 }, new Date('2026-11-19T04:00:00Z')), null);
});
test('schedule validates timezone and interval', () => {
  const base = { enabled: true, start: '09:00', end: '21:00', interval: 120, timezone: 'Asia/Ho_Chi_Minh' };
  assert.equal(goodSchedule(base), true);
  assert.equal(goodSchedule({ ...base, timezone: 'invalid-timezone' }), false);
  assert.equal(goodSchedule({ ...base, start: '22:00' }), false);
  assert.equal(goodSchedule({ ...base, interval: 15 }), true);
  assert.equal(goodSchedule({ ...base, interval: 4 }), false);
});
test('one-device auth secrets have sufficient entropy and compare safely', () => {
  const code = randomSecret();
  assert.ok(code.length >= 40);
  assert.equal(safeCompare('secret','secret'), true);
  assert.equal(safeCompare('secret','secreT'), false);
});
test('push subscription rejects unsafe endpoint hosts', () => {
  const keys = { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) };
  assert.equal(validPushSubscription({endpoint:'https://web.push.apple.com/123',keys}),true);
  assert.equal(validPushSubscription({endpoint:'http://localhost:8080/123',keys}),false);
  assert.equal(validPushSubscription({endpoint:'https://169.254.169.254/latest/meta-data',keys}),false);
});