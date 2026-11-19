import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_SLOGANS, getDailySlogan } from '../daily-slogans.js';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('daily slogans are romantic, bilingual, two-line, and legible on mobile', () => {
  assert.equal(DAILY_SLOGANS.length, 24);
  for (const pair of DAILY_SLOGANS) {
    for (const lang of ['vi', 'en']) {
      const parts = pair[lang].split('|');
      assert.equal(parts.length, 2);
      assert.ok(parts[0].length > 0 && parts[1].length > 0);
      assert.ok(parts[0].length <= 24 && parts[1].length <= 24, pair[lang]);
    }
  }
});

test('the same local day retains the same headline after reopen and language switching', () => {
  const day = '2026-11-19';
  assert.equal(getDailySlogan(day, 'vi'), getDailySlogan(day, 'vi'));
  assert.equal(getDailySlogan(day, 'en'), getDailySlogan(day, 'en'));
  assert.equal(getDailySlogan(day, 'xx'), getDailySlogan(day, 'vi'));
});

test('headline changes every local calendar day without consecutive duplicates', () => {
  let previousVi = null, previousEn = null;
  for (let i = 0; i < 750; i++) {
    const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
    const vi = getDailySlogan(day, 'vi');
    const en = getDailySlogan(day, 'en');
    if (i > 0) { assert.notEqual(vi, previousVi, day); assert.notEqual(en, previousEn, day); }
    previousVi = vi; previousEn = en;
  }
});

test('homepage re-renders greeting on each new day and on language changes', () => {
  assert.match(app, /getDailySlogan\(day, lang\)/);
  assert.match(app, /function renderToday\(\)\s*\{\s*const day = localDayKey\(\);\s*renderDailySlogan\(day\)/);
  assert.match(app, /function applyLocale\(\)\s*\{[\s\S]*?renderToday\(\)/);
  assert.match(app, /if\(localDayKey\(\)!==renderedDay\)\{renderToday\(\)/);
  assert.doesNotMatch(html, /id="today-heading" data-i18n-heading/);
  assert.match(sw, /'\.\/daily-slogans\.js'/);
});

test('empty-day message addresses cục zàng in Vietnamese only', () => {
  assert.match(i18n, /startFresh: 'Bắt đầu một ngày mới nhé, cục zàng ♡'/);
  assert.match(i18n, /startFresh: 'A new day for my darling ♡'/);
  assert.match(html, /id="progress-message">Bắt đầu một ngày mới nhé, cục zàng ♡/);
});
