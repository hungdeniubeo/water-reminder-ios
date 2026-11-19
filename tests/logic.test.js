import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeState, localDayKey, dayKeyOffset, totalForDay,
  getWeekStats, nextReminderSlot
} from '../logic.js';

test('defaults are safe and usable with empty or malformed stored state', () => {
  assert.equal(normalizeState(null).goal, 2000);
  assert.equal(normalizeState({ goal: -5, reminder: { start: '23:00', end: '08:00' } }).goal, 2000);
  assert.equal(normalizeState({ goal: 2500 }).goal, 2500);
  assert.deepEqual(normalizeState({ logs: 'oops' }).logs, []);
});

test('invalid or excessive entries are excluded', () => {
  const logs = [
    { id: 'valid', amount: 250, at: '2026-11-19T09:00:00.000Z', day: '2026-11-19' },
    { id: 'negative', amount: -300, at: '2026-11-19T10:00:00.000Z', day: '2026-11-19' },
    { id: 'huge', amount: 10000, at: '2026-11-19T10:00:00.000Z', day: '2026-11-19' },
    { id: 'bad-date', amount: 200, at: 'tomorrow', day: '2026-11-19' }
  ];
  assert.deepEqual(normalizeState({ logs }).logs.map(x => x.id), ['valid']);
});

test('day totals include only the requested local date', () => {
  const logs = [
    { day: '2026-11-19', amount: 150 },
    { day: '2026-11-19', amount: 250 },
    { day: '2026-11-18', amount: 500 }
  ];
  assert.equal(totalForDay(logs, '2026-11-19'), 400);
  assert.equal(totalForDay(logs, '2026-11-20'), 0);
});

test('last seven days and goal reached count', () => {
  const now = new Date(2026, 10, 19, 12, 0, 0);
  const logs = [
    { day: localDayKey(now), amount: 2000 },
    { day: dayKeyOffset(-1, now), amount: 200 },
    { day: dayKeyOffset(-3, now), amount: 2400 }
  ];
  const stats = getWeekStats(logs, 2000, now);
  assert.equal(stats.days.length, 7);
  assert.equal(stats.days[6].amount, 2000);
  assert.equal(stats.reached, 2);
  assert.equal(stats.average, Math.round(4600 / 7));
});

test('in-app reminder fires only on scheduled minute and once per slot', () => {
  const reminder = { enabled: true, start: '09:00', end: '21:00', interval: 120 };
  const onTime = new Date(2026, 10, 19, 11, 0);
  const slot = nextReminderSlot(onTime, reminder, '');
  assert.equal(slot, '2026-11-19:660');
  assert.equal(nextReminderSlot(onTime, reminder, slot), null);
  assert.equal(nextReminderSlot(new Date(2026, 10, 19, 11, 1), reminder, ''), null);
  assert.equal(nextReminderSlot(new Date(2026, 10, 19, 22, 0), reminder, ''), null);
  assert.equal(nextReminderSlot(onTime, { ...reminder, enabled: false }, ''), null);
});

test('date calculations use the calendar instead of hardcoded milliseconds', () => {
  const d = new Date(2024, 1, 29, 12);
  assert.equal(dayKeyOffset(1, d), '2024-03-01');
});
