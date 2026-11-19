/**
 * Tiny, decorative feedback for a saved drink. No data, network, audio or canvas.
 * The animation is optional: users with Reduce Motion still get the regular toast.
 */
const pulseTimers = new WeakMap();

function pulse(element, className, duration) {
  if (!element) return;
  const timers = pulseTimers.get(element) || {};
  if (timers[className]) clearTimeout(timers[className]);
  element.classList.remove(className);
  // Restart gently for repeated taps without stacking transform animations.
  void element.offsetWidth;
  element.classList.add(className);
  timers[className] = window.setTimeout(() => {
    element.classList.remove(className);
    delete timers[className];
  }, duration);
  pulseTimers.set(element, timers);
}

export function animateHydrationSuccess(amount, goalJustReached = false) {
  if (typeof window === 'undefined' || typeof document === 'undefined' ||
      (typeof window.matchMedia === 'function' &&
       window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return false;

  const card = document.querySelector('.progress-card');
  const ring = document.getElementById('progress-ring');
  if (!card || !ring) return false;

  pulse(card, 'water-card-pop', 800);
  pulse(card, 'water-card-glow', 1100);
  pulse(ring, 'water-ring-bob', 850);
  pulse(document.getElementById('today-total'), 'water-number-bounce', 680);
  pulse(document.getElementById('progress-percent'), 'water-number-bounce', 680);
  pulse(document.querySelector('#today-entries .entry-item'), 'beo-entry-in', 510);
  pulse(document.querySelector('.week-day.is-today'), 'beo-today-ping', 550);

  // Reset transient decorations if Beo logs two drinks in quick succession.
  ring.querySelectorAll('.water-burst, .water-float-label').forEach(node => node.remove());

  const burst = document.createElement('span');
  burst.className = 'water-burst';
  burst.setAttribute('aria-hidden', 'true');
  const points = [
    [-62, -24], [-45, -58], [-7, -77], [34, -64], [63, -30],
    [67, 17], [37, 57], [-12, 65], [-55, 38]
  ];
  points.forEach(([dx, dy], index) => {
    const particle = document.createElement('span');
    const isHeart = goalJustReached && index % 3 === 0;
    particle.className = 'water-particle ' + (isHeart ? 'water-heart' : 'water-drop');
    if (isHeart) particle.textContent = '♡';
    particle.style.setProperty('--dx', dx + 'px');
    particle.style.setProperty('--dy', dy + 'px');
    particle.style.setProperty('--particle-delay', (index % 3) * 35 + 'ms');
    burst.appendChild(particle);
  });

  const label = document.createElement('span');
  label.className = 'water-float-label';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = '+' + Number(amount).toLocaleString() + ' ml ' + (goalJustReached ? '♥' : '♡');
  ring.append(burst, label);
  window.setTimeout(() => { burst.remove(); label.remove(); }, 1250);
  return true;
}


// Lightweight motion cues shared by the three screens. No scroll listeners,
// animation libraries or persistent timers; decorations never hold user data.
function motionEnabled() {
  return typeof document !== 'undefined' &&
    typeof window !== 'undefined' &&
    !(typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function replay(element, className, duration = 520) {
  if (!motionEnabled() || !element || !element.isConnected) return false;
  pulse(element, className, duration);
  return true;
}

export function animateScreenEntry(screen) {
  if (!screen || screen.hidden) return false;
  const done = replay(screen, 'beo-screen-in', 560);
  replay(screen.querySelector('.hero-intro'), 'beo-hero-in', 600);
  return done;
}

export function animateWeekChange(direction) {
  if (!motionEnabled()) return false;
  const name = direction > 0 ? 'beo-slide-right' : 'beo-slide-left';
  const done = replay(document.getElementById('home-week-days'), name, 420);
  replay(document.getElementById('week-range'), 'beo-label-in', 420);
  return done;
}

export function animateCalendarChange(direction) {
  if (!motionEnabled()) return false;
  const name = direction > 0 ? 'beo-slide-right' : 'beo-slide-left';
  const done = replay(document.getElementById('calendar-grid'), name, 410);
  replay(document.getElementById('calendar-month'), 'beo-label-in', 410);
  return done;
}

export function animateDaySelection() {
  if (!motionEnabled()) return false;
  const screen = document.getElementById('screen-history');
  if (!screen || screen.hidden) return false;
  return replay(document.querySelector('.day-journal-card'), 'beo-day-in', 450);
}

export function animateChipSelection(button) {
  return replay(button, 'beo-chip-pop', 390);
}

export function animateFeedback(element) {
  return replay(element, 'beo-feedback-in', 490);
}

export function animateSave(element) {
  return replay(element, 'beo-save-glow', 750);
}

export function animateEntry(element) {
  return replay(element, 'beo-entry-in', 510);
}

export function animateToast(element) {
  return replay(element, 'beo-toast-in', 400);
}

export function animateBarChart(container) {
  if (!motionEnabled() || !container || !container.isConnected) return false;
  const screen = container.closest('.screen');
  if (!screen || screen.hidden) return false;
  const fills = [...container.querySelectorAll('.bar-fill')];
  if (!fills.length) return false;
  const targets = fills.map(node => node.style.height);
  for (const node of fills) {
    node.style.transition = 'none';
    node.style.height = '0%';
  }
  // Two frames ensure WebKit registers the zero-height starting point.
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    if (!container.isConnected || screen.hidden) return;
    fills.forEach((node, index) => {
      node.style.transition = 'height .7s cubic-bezier(.2,.8,.25,1)';
      node.style.height = targets[index];
    });
  }));
  return true;
}
