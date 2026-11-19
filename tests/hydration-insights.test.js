import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanBodyNotes, completedDaySummary, recentGoalStreak, monthlyCalendar, dateWithinJournal } from '../hydration-insights.js';

test('days without entries are missing, not zero-intake or missed goal days', () => {
  const logs = [{ day:'2026-11-18', amount:1000 }, {day:'2026-11-16', amount:2100}];
  const r = completedDaySummary(logs, 2000, new Date(2026,10,19,12));
  assert.equal(r.loggedDays, 2); assert.equal(r.missingDays, 5);
  assert.equal(r.goalDays, 1); assert.equal(r.lowerDays, 1);
  assert.equal(r.averageLogged, 1550);
});

test('today is excluded from completed day trends', () => {
  const logs = [{day:'2026-11-19', amount:150}, {day:'2026-11-18', amount:2000}];
  const r = completedDaySummary(logs, 2000, new Date(2026,10,19,15));
  assert.equal(r.loggedDays, 1);assert.equal(r.averageLogged, 2000);
});

test('no logs does not imply dehydration', () => {
  const r = completedDaySummary([], 2000, new Date(2026,10,19,12));
  assert.equal(r.averageLogged, null);assert.equal(r.lowerDays,0);
});

test('streak follows completed yesterday and ends on a missed day', () => {
  const logs = [{day:'2026-11-18',amount:2000},{day:'2026-11-17',amount:2100},{day:'2026-11-15',amount:2500}];
  assert.equal(recentGoalStreak(logs,2000,new Date(2026,10,19,12)),2);
});

test('calendar uses Monday first and prevents future logging', () => {
  const d = new Date(2026,10,19,12);
  const cells = monthlyCalendar(d,d);
  assert.equal(cells[0],null);
  assert.equal(cells.filter(c=>c?.future).length,11);
  assert.equal(dateWithinJournal('2026-11-18',d),true);
  assert.equal(dateWithinJournal('2026-11-20',d),false);
  assert.equal(dateWithinJournal('2026-02-30',d),false);
});

test('body notes store only selected known keys', () => {
  assert.deepEqual(cleanBodyNotes({'2026-11-18':{symptoms:['thirst','thirst','unsafe'],contexts:['exercise','unsafe']}}),{
    '2026-11-18':{symptoms:['thirst'],contexts:['exercise']}
  });
});