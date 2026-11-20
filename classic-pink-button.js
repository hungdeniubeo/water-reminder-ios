/** A gentle water-drop interaction: tap to splash, hold to keep splashing. Never sends a push. */
export function attachClassicPinkButton(button) {
  const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const MAX_PARTICLES = 64;
  const HOLD_INTERVAL_MS = 130;
  let holdTimer = null;
  let pointerTriggered = false;

  const stop = () => {
    if (holdTimer !== null) clearInterval(holdTimer);
    holdTimer = null;
  };
  const add = node => {
    node.setAttribute('aria-hidden', 'true');
    button.append(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
    // Also clean up if the device pauses CSS animations.
    setTimeout(() => node.remove(), 1100);
  };
  function splash() {
    if (button.disabled || reducedMotion()) return;
    const existing = button.querySelectorAll('.ring, .spark');
    const overflow = Math.max(0, existing.length - (MAX_PARTICLES - 7));
    for (let i = 0; i < overflow; i++) existing[i].remove();

    const ring = document.createElement('span');
    ring.className = 'ring r1';
    add(ring);
    button.classList.remove('pop');
    void button.offsetWidth;
    button.classList.add('pop');

    const radius = button.offsetWidth * .76;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i + (Math.random() - .5) * .35;
      const distance = radius * (.78 + Math.random() * .38);
      const drop = document.createElement('span');
      drop.className = i % 2 ? 'spark alt' : 'spark';
      drop.style.setProperty('--dx', (Math.cos(angle) * distance).toFixed(1) + 'px');
      drop.style.setProperty('--dy', (Math.sin(angle) * distance).toFixed(1) + 'px');
      add(drop);
    }
  }

  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (button.disabled) return;
    stop();
    pointerTriggered = true;
    splash();
    if (!reducedMotion()) holdTimer = setInterval(splash, HOLD_INTERVAL_MS);
    try { button.setPointerCapture?.(event.pointerId); } catch { /* Safe without capture. */ }
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', stop);
  button.addEventListener('click', event => {
    if (!pointerTriggered || event.detail === 0) splash(); // Keyboard and assistive technology.
    pointerTriggered = false;
    stop();
  });
  globalThis.addEventListener?.('blur', stop);
  globalThis.document?.addEventListener?.('visibilitychange', () => { if (document.hidden) stop(); });
  return splash;
}
