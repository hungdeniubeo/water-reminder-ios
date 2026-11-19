import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { animateHydrationSuccess } from '../motion.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('background ambience is decorative and does not intercept iPhone swipes',()=>{
  assert.match(html,/class="ambient-motion" aria-hidden="true"/);
  assert.match(css,/\.ambient-motion\{[^}]*pointer-events:none/);
  assert.match(css,/\.app-shell>.topbar,\.app-shell>main\{position:relative;z-index:1\}/);
  assert.match(css,/@keyframes beo-orb-drift/);
});
test('successful drink logs animate once, only on today view after rendering',()=>{
  assert.match(app,/import \{ animateHydrationSuccess \} from '\.\/motion\.js';/);
  assert.match(app,/if \(currentScreen === 'today'\) requestAnimationFrame/);
  assert.match(app,/animateHydrationSuccess\(amount, before < state\.goal && before \+ amount >= state\.goal\)/);
});
test('effect can safely skip entirely without a browser',()=>{
  assert.equal(animateHydrationSuccess(250,false),false);
});
test('reduced motion is respected and repeated effects get cleaned up',()=>{
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.water-particle,\.water-float-label/);
  const motion=readFileSync(new URL('../motion.js',import.meta.url),'utf8');
  assert.match(motion,/prefers-reduced-motion: reduce/);
  assert.match(motion,/ring\.querySelectorAll\('\.water-burst, \.water-float-label'\)/);
  assert.match(motion,/burst\.remove\(\); label\.remove\(\)/);
});
test('offline cache includes optional motion module without changing push handling',()=>{
  assert.match(sw,/water-reminder-static-v13-floating-beo/);
  assert.match(sw,/'\.\/motion\.js'/);
  assert.match(sw,/self\.addEventListener\('push'/);
});
