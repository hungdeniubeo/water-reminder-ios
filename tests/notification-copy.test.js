import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messages } from '../i18n.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('Beo can opt into rotating notes by clearing the custom message',()=>{
  for(const lang of ['vi','en']) assert.ok(messages[lang].soloMessageHint.length>30);
  assert.match(html,/id="solo-message" maxlength="150"/);
  assert.match(html,/data-i18n="soloMessageHint"/);
  assert.match(sw,/water-reminder-static-v18-loving-push/);
  assert.match(sw,/self\.registration\.showNotification/);
});
