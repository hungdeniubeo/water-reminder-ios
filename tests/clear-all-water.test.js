import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearWaterLogs, normalizeState } from '../logic.js';
import { messages } from '../i18n.js';

const app = readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css = readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const sw = readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('delete all removes water entries across every day but keeps existing settings', () => {
  const logs = [
    {id:'today',day:'2026-11-19',amount:250,at:'2026-11-19T08:00:00.000Z'},
    {id:'past',day:'2026-11-05',amount:500,at:'2026-11-05T08:00:00.000Z'}
  ];
  const existing=normalizeState({goal:2500,reminder:{enabled:true,start:'09:00',end:'21:00',interval:90},logs, lastReminderSlot:'slot'});
  const cleared=clearWaterLogs(existing);
  assert.deepEqual(cleared.logs,[]);
  assert.equal(cleared.goal,2500);
  assert.deepEqual(cleared.reminder,existing.reminder);
  assert.equal(cleared.lastReminderSlot,'slot');
  assert.equal(existing.logs.length,2,'original logs remain available for undo');
  assert.notEqual(cleared,existing,'do not mutate the old state');
});

test('only one destructive button, labelled Xoá in Vietnamese, in settings near backup',()=>{
  assert.equal((html.match(/id="clear-water-all"/g)||[]).length,1);
  assert.match(html,/id="clear-water-all"[^>]*data-i18n="clearWaterButton"[^>]*disabled>Xoá<\/button>/);
  assert.ok(html.indexOf('id="clear-water-all"')>html.indexOf('id="export-backup"'));
  assert.match(css,/\.clear-water-button\{[^}]*min-height:44px/);
  assert.equal(messages.vi.clearWaterButton,'Xoá');
  assert.equal(messages.en.clearWaterButton,'Delete');
});

test('full deletion is confirmed, persisted, reflected on all views and undoable',()=>{
  assert.match(app,/if \(!window\.confirm\(t\('clearWaterConfirm'\)\)\) return/);
  assert.match(app,/state = clearWaterLogs\(state\)/);
  assert.match(app,/if \(!persistState\(\)\) \{\s*state = \{ \.\.\.state, logs: snapshot \}/);
  assert.match(app,/renderToday\(\); renderHistory\(\); journal\?\.render\(\); renderSettings\(\)/);
  assert.match(app,/toast\(t\('clearWaterDone'\), \(\) =>/);
  assert.match(app,/new Set\(state\.logs\.map\(item => item\.id\)\)/);
  assert.match(app,/el\('clear-water-all'\)\.addEventListener\('click', clearAllWater\)/);
  assert.match(app,/el\('clear-water-all'\)\.disabled = state\.logs\.length === 0/);
  assert.match(sw,/water-reminder-static-v17-clear-history/);
});

test('confirm copy explicitly covers every day without removing notes or reminders',()=>{
  for(const language of ['vi','en']){
    assert.ok(messages[language].clearWaterConfirm.includes(language==='vi'?'ghi chú cơ thể':'body notes'));
    assert.ok(messages[language].clearWaterConfirm.includes(language==='vi'?'lịch nhắc':'reminders'));
  }
});
