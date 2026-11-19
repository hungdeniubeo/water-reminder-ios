import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupReminderIntervalPicker } from '../reminder-picker.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../reminder-picker.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('custom reminder menu replaces the native iOS popup without changing the schedule source',()=>{
  assert.match(html,/id="beo-interval-picker"/);
  assert.match(html,/<select id="remind-interval" aria-labelledby="beo-interval-label">/);
  assert.match(css,/\.beo-interval-picker\.beo-enhanced > #remind-interval\{display:none!important\}/);
  assert.match(app,/el\('remind-interval'\)\.value = String\(state\.reminder\.interval\)/);
  assert.match(app,/intervalPicker\.sync\(\)/);
  assert.match(app,/Number\(el\('remind-interval'\)\.value\)/);
});

test('menu has exactly four translated options, large touch targets and a clear selected state',()=>{
  const values=[...html.matchAll(/class="beo-interval-option" role="option" id="beo-interval-opt-\d+" data-interval="(\d+)"/g)].map(m=>m[1]);
  assert.deepEqual(values,['60','90','120','180']);
  for(const key of ['interval60','interval90','interval120','interval180']){
    assert.match(html,new RegExp('class="beo-option-text" data-i18n="'+key+'"'));
  }
  assert.match(html,/role="listbox" tabindex="-1"/);
  assert.match(html,/aria-haspopup="listbox" aria-expanded="false"/);
  assert.match(css,/\.beo-interval-option\[aria-selected="true"\]/);
  assert.match(css,/min-height:47px/);
});

test('selection dispatches the existing change event and closes when tapping outside',()=>{
  assert.match(js,/input\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(js,/document\.addEventListener\('pointerdown'/);
  assert.match(js,/menu\.addEventListener\('keydown'/);
  assert.match(js,/parentForm\?\.classList\.add\('beo-interval-layer'\)/);
  assert.match(app,/\['remind-start','remind-end','remind-interval'\]/);
});

test('dropdown opens above if near bottom and respects reduced motion',()=>{
  assert.match(js,/window\.visualViewport/);
  assert.match(js,/root\.classList\.toggle\('drop-up'/);
  assert.match(css,/\.beo-interval-picker\.drop-up \.beo-interval-menu/);
  assert.match(css,/@keyframes beo-interval-confirm/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});

test('UI stays usable without JavaScript and is cached for offline iPhone use',()=>{
  assert.match(css,/\.beo-interval-picker:not\(\.beo-enhanced\) \.beo-interval-menu\{display:none\}/);
  assert.match(html,/id="beo-interval-trigger"[^>]+ hidden>/);
  assert.match(sw,/'\.\/reminder-picker\.js'/);
  assert.match(sw,/water-reminder-static-v15-interval-menu-motion/);
  const picker=setupReminderIntervalPicker();
  assert.equal(typeof picker.sync,'function');
  assert.equal(typeof picker.close,'function');
  assert.doesNotThrow(()=>picker.sync());
  assert.doesNotThrow(()=>picker.close());
});
