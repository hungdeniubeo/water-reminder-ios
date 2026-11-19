import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWeekWindow, swipeWeekDirection } from '../week-strip.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const journal=readFileSync(new URL('../journal-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('current week shows exactly 7 local dates ending today, never the future',()=>{
  const current=getWeekWindow(0,new Date(2026,10,19,12));
  assert.deepEqual(current.days,['2026-11-13','2026-11-14','2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19']);
  assert.equal(current.canNewer,false);
  assert.equal(current.canOlder,true);
});

test('previous and next seven-day windows are adjacent and reversible',()=>{
  const now=new Date(2026,10,19,12);
  const older=getWeekWindow(1,now);
  const earliest=getWeekWindow(2,now);
  assert.deepEqual(older.days,['2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10','2026-11-11','2026-11-12']);
  assert.equal(older.canNewer,true);
  assert.equal(earliest.days[6],'2026-11-05');
  assert.deepEqual(getWeekWindow(-3,now),getWeekWindow(0,now));
});

test('year and month boundaries retain calendar dates, not UTC-day shifts',()=>{
  const week=getWeekWindow(0,new Date(2027,0,2,12));
  assert.equal(week.days[0],'2026-12-27');
  assert.equal(week.days[6],'2027-01-02');
});

test('history cannot page to future weeks or past the journal lower limit',()=>{
  const now=new Date(2020,0,8,12);
  assert.equal(getWeekWindow(0,now).canOlder,true);
  assert.equal(getWeekWindow(1,now).canOlder,false);
  assert.equal(getWeekWindow(0,now).canNewer,false);
});

test('sideways swipe changes week; vertical scroll and small drags do not',()=>{
  assert.equal(swipeWeekDirection(90,3),1);
  assert.equal(swipeWeekDirection(-90,4),-1);
  assert.equal(swipeWeekDirection(25,1),0);
  assert.equal(swipeWeekDirection(50,60),0);
  assert.equal(swipeWeekDirection(NaN,0),0);
});

test('iPhone swipe, buttons, day selection and language labels are connected',()=>{
  assert.match(html,/id="week-prev"/);
  assert.match(html,/id="week-next"/);
  assert.match(html,/id="week-range"/);
  assert.match(journal,/touchstart/);
  assert.match(journal,/touchend/);
  assert.match(journal,/touchcancel/);
  assert.match(journal,/changeWeek\(direction\)/);
  assert.match(journal,/selectDay\(day\);openHistory\(\)/);
  assert.match(journal,/dateWithinJournal\(day\)/);
  assert.match(css,/\.week-peek-days\{[^}]*touch-action:pan-y/);
  assert.match(sw,/\.\/week-strip\.js/);
});

test('personal app has no header help icon or unused about modal handlers',()=>{
  assert.doesNotMatch(html,/id="about-button"/);
  assert.doesNotMatch(html,/id="about-dialog"/);
  assert.doesNotMatch(app,/el\('about-button'\)|el\('close-about'\)|el\('got-it'\)/);
});
