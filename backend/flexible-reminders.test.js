import test from 'node:test';
import assert from 'node:assert/strict';
import { slotsForDay, validSchedule, copyForSlot } from '../routine-schedule.js';
const base={id:'sample',enabled:true,days:127,time:'08:00',title:'A',body:'a'};
test('repeat honors selected weekdays and interval',()=>{
  const r={...base,days:62,schedule:{kind:'repeat',start:'08:00',end:'09:00',interval:30}};
  assert.deepEqual(slotsForDay(r,'2026-11-25'),[480,510,540]);
  assert.deepEqual(slotsForDay(r,'2026-11-28'),[]);
});
test('random slots are stable, distinct, within bounds and adequately spaced',()=>{
  const r={...base,schedule:{kind:'random',start:'09:00',end:'21:00',count:5}};
  for(let i=1;i<=30;i++){
    const day='2026-11-'+String(i).padStart(2,'0');
    const a=slotsForDay(r,day);
    assert.deepEqual(a,slotsForDay(r,day));
    assert.equal(a.length,5);
    assert.ok(a.every((x,j)=>x>=540&&x<=1260&&(!j||x-a[j-1]>=15)));
  }
  assert.notDeepEqual(slotsForDay(r,'2026-11-25'),slotsForDay(r,'2026-11-26'));
  assert.equal(validSchedule({kind:'random',start:'08:00',end:'08:10',count:2}),false);
});
test('date cycles skip impossible dates and do not occur before the first date',()=>{
  const r={...base,schedule:{kind:'date',date:'2026-01-31',cycle:'monthly'}};
  assert.deepEqual(slotsForDay(r,'2026-01-31'),[480]);
  assert.deepEqual(slotsForDay(r,'2026-02-28'),[]);
  assert.deepEqual(slotsForDay(r,'2026-03-31'),[480]);
  assert.deepEqual(slotsForDay(r,'2025-12-31'),[]);
  assert.equal(validSchedule({kind:'date',date:'2026-02-30',cycle:'once'}),false);
});
test('copy selection is stable for a slot and cycles without adjacent repeats in a day',()=>{
  const r={...base,schedule:{kind:'repeat',start:'08:00',end:'10:00',interval:30,messages:[{title:'B',body:'b'},{title:'C',body:'c'}]}};
  const slots=['08:00','08:30','09:00','09:30','10:00'].map(x=>'2026-11-25:'+x);
  const selected=slots.map(slot=>copyForSlot(r,slot).title);
  assert.equal(new Set(selected.slice(0,3)).size,3);
  assert.ok(selected.every((x,i)=>!i||x!==selected[i-1]));
  assert.equal(copyForSlot(r,slots[0]).title,selected[0]);
});
