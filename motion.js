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
