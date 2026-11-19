import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REMINDER_MESSAGES, selectReminderMessage } from './reminder-messages.js';

const worker = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const setup = {timezone:'Asia/Ho_Chi_Minh', start_time:'09:00', end_time:'21:00', interval_minutes:120,lang:'vi',note_to_partner:''};

test('24 concise, gentle and unique notifications exist in both languages', () => {
  for (const language of ['vi','en']) {
    const list = REMINDER_MESSAGES[language];
    assert.equal(list.length,24);
    assert.equal(new Set(list).size,24);
    for(const body of list) {
      assert.ok(body.length <= 115 && body.length > 18,body);
      assert.doesNotMatch(body,/^Ê(?:\s|[,!])|uống nước đi[!.]/i);
    }
  }
});

test('each scheduled slot has a deterministic message but adjacent slots do not repeat', () => {
  for(const interval of [60,90,120,180]) {
    let prev = null, seen = new Set();
    for(let day = 1; day <= 32; day++){
      const date = new Date(Date.UTC(2026,10,day)).toISOString().slice(0,10);
      for(let minute=540;minute<=1260;minute+=interval) {
        const msg = selectReminderMessage({...setup,interval_minutes:interval},{slot:date+':'+minute});
        assert.notEqual(msg,prev,'repeated between consecutive push reminders');
        assert.equal(selectReminderMessage({...setup,interval_minutes:interval},{slot:date+':'+minute}),msg);
        seen.add(msg);prev=msg;
      }
    }
    assert.ok(seen.size>=12,'messages should rotate widely');
  }
});

test('saved personal note overrides rotation; blank note re-enables it',()=>{
  assert.equal(selectReminderMessage({...setup,note_to_partner:'  Anh thương Beo ♡  '},{slot:'2026-11-19:540'}),'Anh thương Beo ♡');
  assert.notEqual(selectReminderMessage({...setup,note_to_partner:' '},{slot:'2026-11-19:540'}),' ');
  assert.equal(selectReminderMessage({...setup,lang:'xx'},{slot:'2026-11-19:540'}),selectReminderMessage(setup,{slot:'2026-11-19:540'}));
});

test('test push selects a fresh message after the 2 minute rate limit',()=>{
  const first=selectReminderMessage(setup,{testAt:1830000000});
  const second=selectReminderMessage(setup,{testAt:1830000120});
  assert.notEqual(first,second);
  assert.equal(first,selectReminderMessage(setup,{testAt:1830000000}));
});

test('English copy is translated and timezone fallback is safe',()=>{
  const local=selectReminderMessage(setup,{now:new Date('2026-11-19T04:00:00Z')});
  const slot=selectReminderMessage(setup,{slot:'2026-11-19:660'});
  assert.equal(local,slot);
  const english=selectReminderMessage({...setup,lang:'en'},{slot:'2026-11-19:660'});
  assert.ok(REMINDER_MESSAGES.en.includes(english));
  assert.ok(REMINDER_MESSAGES.vi.includes(local));
});

test('Worker sends rotated scheduled notes and respects device custom text',()=>{
  assert.match(worker,/import \{ selectReminderMessage \} from '\.\/reminder-messages\.js'/);
  assert.match(worker,/const body = selectReminderMessage\(device, context\)/);
  assert.match(worker,/notify\(env,device,\{slot\}\)/);
  assert.match(worker,/notify\(env,device,\{testAt:last\}\)/);
  assert.match(worker,/const title = 'Water ♡'/);
});
