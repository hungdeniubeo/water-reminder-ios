import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('three bottom tabs occupy three equal grid columns', () => {
  const nav = html.match(/<nav class="tabbar"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav, 'bottom navigation is present');
  assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(m=>m[1]), ['today','history','settings']);
  assert.match(css, /\.tabbar\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.tabbar\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test('bottom navigation and main content respect iPhone safe area', () => {
  assert.match(css, /\.tabbar\{[^}]*env\(safe-area-inset-bottom,0px\)/);
  assert.match(css, /main\{padding-bottom:calc\(132px \+ env\(safe-area-inset-bottom,0px\)\)\}/);
});

test('water card footer and compact calendar remain aligned', () => {
  assert.match(css, /\.card-foot\{[\s\S]*?margin:0 calc\(0px - var\(--progress-gutter\)\)/);
  assert.match(css, /\.calendar-date\{min-height:0\}/);
  assert.match(css, /\.reminder-fields\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

test('the PWA prevents accidental pinch zoom and iOS input focus zoom', () => {
  assert.match(html, /maximum-scale=1, user-scalable=no/);
  assert.match(css, /input,textarea,select\{font-size:16px!important/);
  assert.match(app, /\['gesturestart','gesturechange','gestureend'\]/);
});

test('single-device privacy copy has no obsolete partner references', () => {
  assert.doesNotMatch(html, /không gửi cho người kia/);
  assert.doesNotMatch(html.match(/<nav class="tabbar"[\s\S]*?<\/nav>/)?.[0]||'', /data-tab="couple"/);
});

test('brand wordmark and dedication have comfortable tracking on iPhone', () => {
  assert.match(css, /\.identity strong\{[^}]*letter-spacing:-\.04em/);
  assert.match(css, /\.identity small\{[^}]*letter-spacing:\.145em/);
  assert.match(css, /@media\(max-width:428px\)\{[^}]*\}\.topbar\{[^}]*\}\.identity small\{letter-spacing:\.145em\}/);
});

test('app blocks selecting or copying static UI while retaining editable fields', () => {
  assert.match(css, /-webkit-user-select:none/);
  assert.match(css, /-webkit-touch-callout:none/);
  assert.match(css, /input,textarea,\[contenteditable="true"\]\{[^}]*-webkit-user-select:text/);
  assert.match(app, /\['copy', 'cut', 'contextmenu', 'selectstart'\]/);
  assert.match(app, /isEditableControl\(event.target\)/);
});


test('the brand uses a Neutra-inspired display stack with a Vietnamese fallback', () => {
  assert.match(html, /family=Be\+Vietnam\+Pro/);
  assert.match(css, /--beo-display-font:"UTM Neutra","Be Vietnam Pro"/);
  assert.match(css, /\.hero-intro h1\{[^}]*font-weight:600/);
  assert.match(css, /\.hero-intro h1 em\{[^}]*font-style:normal/);
  assert.match(css, /\.identity strong\{[^}]*font-size:1\.44rem/);
});


test('progress banner centers the sparkle and message together', () => {
  const rules = [...css.matchAll(/\.card-foot\{([^}]+)\}/g)].map(match => match[1]);
  assert.ok(rules.some(rule => rule.includes('justify-content:center')), 'banner group is centered');
  assert.match(css, /\.card-foot #progress-message\{[^}]*flex:0 1 auto;text-align:center/);
});
