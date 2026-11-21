import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_COPIES, HOME_COPY_KEY, pickHomeCopy } from '../water-notes.js';
import { normalizeReceiverProfile } from '../receiver.js';

test('home greetings are readable, varied and appropriate for Beo', () => {
  assert.ok(HOME_COPIES.length >= 20);
  assert.equal(new Set(HOME_COPIES.map(c => c.title)).size, HOME_COPIES.length);
  for (const copy of HOME_COPIES) {
    assert.ok(copy.eyebrow.length >= 12 && copy.eyebrow.length <= 42);
    assert.ok(copy.title.length >= 12 && copy.title.length <= 45);
    assert.ok(copy.body.length >= 20 && copy.body.length <= 105);
  }
});

test('a refresh rotates to a different greeting, even with a deterministic random number', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
  for (const random of [() => 0, () => .999999]) {
    let previous = null;
    for (let i=0; i<100; i++) {
      const current = pickHomeCopy({storage,random});
      if (previous) assert.notEqual(current.title,previous.title);
      previous=current;
      assert.match(data.get(HOME_COPY_KEY),/^\d+$/);
    }
  }
});

test('custom homepage text remains personal and automatic rotation is wired into the live receiver', () => {
  const source=readFileSync(new URL('../receiver.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(source,/automaticCopy = state\.profile\.homeMessage === DEFAULT_PROFILE\.homeMessage/);
  assert.match(source,/automaticCopy \? homeCopy\.body : state\.profile\.homeMessage/);
  assert.match(source,/automaticCopy \? homeCopy\.title : state\.profile\.recipientName/);
  assert.match(html,/id="home-eyebrow"/);
  assert.match(sw,/water-reminder-static-v31-bell-reminders/);
  assert.match(sw,/water-notes\.js\?v=20261120-home-copy-v1/);
  assert.equal(normalizeReceiverProfile({homeMessage:'Lời nhắn riêng ♡'}).homeMessage,'Lời nhắn riêng ♡');
});
