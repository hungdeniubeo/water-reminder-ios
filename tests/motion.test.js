import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { animateHydrationSuccess } from '../motion.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('only the original pink gradient has a gentle water sway behind the app',()=>{
  assert.match(html,/class="ambient-motion" aria-hidden="true"/);
  assert.match(html,/class="ambient-wave"/);
  assert.doesNotMatch(html,/class="ambient-(?:orb|heart)/);
  assert.match(css,/\.ambient-motion\{[^}]*pointer-events:none/);
  assert.match(css,/\.app-shell>\.topbar,\.app-shell>main\{position:relative;z-index:1\}/);
  assert.match(css,/\.ambient-wave\{[^}]*animation:beo-water-sway 23s/);
  assert.match(css,/@keyframes beo-water-sway/);
  assert.match(css,/background:radial-gradient\(circle at 88% 1%,#ffe9ef 0,#fff9fa 26%,#fff9fa 75%\)/);
  assert.match(css,/\.ambient-wave,\.card-foot:after,[\s\S]*?animation:none!important/);
});
test('successful drink logs animate once, only on today view after rendering',()=>{
  assert.match(app,/import \{ animateHydrationSuccess(?:, [^}]+)? \} from '\.\/motion\.js';/);
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
  assert.match(sw,/water-reminder-static-v16-pink-water-sway/);
  assert.match(sw,/'\.\/motion\.js'/);
  assert.match(sw,/self\.addEventListener\('push'/);
});


test('all three views play a stable entrance, without touching tab layout or iOS safe area',()=>{
  assert.match(app,/animateScreenEntry\(el\('screen-'\+screen\)\)/);
  assert.match(css,/\.screen\.beo-screen-in\{/);
  assert.match(css,/\.tab\.active svg\{/);
  assert.match(css,/\.toast\.beo-toast-in\{/);
  assert.match(css,/translate3d\(-50%,10px,0\)/);
});
test('past-day journal, week swipes and month paging have motion cues',()=>{
  const journal=readFileSync(new URL('../journal-ui.js',import.meta.url),'utf8');
  assert.match(journal,/animateWeekChange\(direction\)/);
  assert.match(journal,/animateCalendarChange\(1\)/);
  assert.match(journal,/animateCalendarChange\(-1\)/);
  assert.match(journal,/animateDaySelection\(\)/);
  assert.match(app,/renderToday\(\);renderHistory\(\);journal\?\.render\(\)/);
});
test('selected wellbeing chips, save feedback and live chart are animated',()=>{
  const journal=readFileSync(new URL('../journal-ui.js',import.meta.url),'utf8');
  assert.match(journal,/animateChipSelection\(b\)/);
  assert.match(journal,/animateSave\(el\('save-body-checkin'\)\)/);
  assert.match(app,/animateBarChart\(bars\)/);
  assert.match(app,/animateSave\(el\('goal-form'\)\)/);
  assert.match(app,/animateSave\(el\('reminder-form'\)\)/);
});
test('whole-app animation helpers skip safely in Node and honor reduced motion',async()=>{
  const motion=await import('../motion.js');
  for(const action of [
    ()=>motion.animateScreenEntry(null),
    ()=>motion.animateWeekChange(1),
    ()=>motion.animateCalendarChange(-1),
    ()=>motion.animateDaySelection(),
    ()=>motion.animateChipSelection(null),
    ()=>motion.animateFeedback(null),
    ()=>motion.animateSave(null),
    ()=>motion.animateEntry(null),
    ()=>motion.animateToast(null),
    ()=>motion.animateBarChart(null)
  ])assert.equal(action(),false);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/transition-duration:\.01ms!important/);
});
