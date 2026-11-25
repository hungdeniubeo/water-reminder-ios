import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingReminders} from '../admin-features.js';

const settings = {enabled:false,start:'09:00',end:'21:00',interval:120,timezone:'Asia/Ho_Chi_Minh'};
const reminders = [
  {label:'Đi làm',time:'08:00',days:62,enabled:true},
  {label:'Ăn trưa',time:'11:50',days:127,enabled:true},
  {label:'Đi ngủ',time:'22:00',days:127,enabled:false}
];
test('daily agenda prioritizes active daily reminders and skips past slots', () => {
  const now = new Date('2026-11-23T03:30:00Z'); // Monday 10:30 Vietnam
  assert.deepEqual(upcomingReminders(settings,reminders,now,3).map(x=>x.when),['Hôm nay · 11:50','Ngày mai · 08:00','Ngày mai · 11:50']);
});
test('water is only a supporting repeated reminder, sorted alongside routines',()=>{
  const now=new Date('2026-11-23T01:00:00Z'); // 08:00 Vietnam
  const result=upcomingReminders({...settings,enabled:true,start:'09:00',end:'11:00',interval:60},reminders,now,4);
  assert.deepEqual(result.map(x=>[x.title,x.when]),[
    ['Nhắc lặp trong ngày','Hôm nay · 09:00'],
    ['Ăn trưa','Hôm nay · 11:50'],
    ['Đi làm','Ngày mai · 08:00'],
    ['Nhắc lặp trong ngày','Ngày mai · 09:00']
  ]);
});
test('empty, invalid timezone, or disabled reminders give no false future delivery promises',()=>{
  assert.deepEqual(upcomingReminders(settings,[],new Date('2026-11-23T01:00:00Z')),[]);
  assert.deepEqual(upcomingReminders({...settings,timezone:'Invalid/TZ'},reminders),[]);
});

test('agenda uses the same slot calculation for repeated, random and calendar dates',()=>{
  const now=new Date('2026-11-23T03:30:00Z');
  const more=[{id:'repeat',label:'Nghỉ mắt',time:'09:00',days:127,enabled:true,schedule:{kind:'repeat',start:'09:00',end:'12:00',interval:60}},{id:'anniversary',label:'Kỷ niệm',time:'08:00',days:127,enabled:true,schedule:{kind:'date',date:'2026-12-25',cycle:'once'}}];
  assert.equal(upcomingReminders(settings,more,now,1)[0].when,'Hôm nay · 11:00');
  assert.equal(upcomingReminders(settings,more.slice(1),now,1)[0].when,'25/12/2026 · 08:00');
  const random={id:'random',label:'Bất ngờ',time:'09:00',days:127,enabled:true,schedule:{kind:'random',start:'12:00',end:'18:00',count:3}};
  assert.deepEqual(upcomingReminders(settings,[random],now,1),upcomingReminders(settings,[random],now,1));
});
