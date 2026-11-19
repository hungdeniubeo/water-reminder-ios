import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, setLanguage, translate, messages, LANGUAGE_KEY, formatDate, formatNumber } from '../i18n.js';

const storage = initial => {
  const map = new Map(Object.entries(initial ?? {}));
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};

test('translation keys are complete in both languages', () => {
  const vi = Object.keys(messages.vi).sort();
  const en = Object.keys(messages.en).sort();
  assert.deepEqual(vi, en);
  assert.ok(vi.length > 80);
});

test('Vietnamese is default and language selection persists', () => {
  const s = storage();
  assert.equal(getLanguage(s), 'vi');
  assert.equal(setLanguage('en', s), true);
  assert.equal(getLanguage(s), 'en');
  assert.equal(s.getItem(LANGUAGE_KEY), 'en');
  assert.equal(setLanguage('unknown', s), false);
  assert.equal(getLanguage(s), 'en');
});

test('plural messages are localized', () => {
  assert.equal(translate('entryCount', 'vi', { count: 2 }), '2 LẦN');
  assert.equal(translate('entryCount', 'en', { count: 1 }), '1 entry');
  assert.equal(translate('entryCount', 'en', { count: 2 }), '2 entries');
  assert.equal(translate('remaining', 'vi', { amount: '250' }), 'Còn 250 ml để đạt mục tiêu');
});

test('locale formatting changes with language', () => {
  assert.equal(formatNumber(2000, 'vi'), '2.000');
  assert.equal(formatNumber(2000, 'en'), '2,000');
  const date = new Date(2026, 10, 19, 12);
  assert.match(formatDate(date, 'vi', { weekday: 'long' }).toLowerCase(), /thứ năm/);
  assert.match(formatDate(date, 'en', { weekday: 'long' }), /Thursday/);
});
