/** The user's Classic Pink button, with bounded particles and keyboard support. */
export function attachClassicPinkButton(button) {
  const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function fire() {
    if (button.disabled || reducedMotion()) return;
    button.querySelectorAll('.ring, .spark').forEach(node => node.remove());
    const add = (node) => {
      node.setAttribute('aria-hidden', 'true');
      button.append(node);
      node.addEventListener('animationend', () => node.remove(), { once: true });
      setTimeout(() => node.remove(), 1400);
    };
    for (const name of ['r1', 'r2', 'r3']) {
      const ring = document.createElement('span');
      ring.className = `ring ${name}`;
      add(ring);
    }
    button.classList.remove('pop');
    void button.offsetWidth;
    button.classList.add('pop');
    const radius = button.offsetWidth * .95;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i + (Math.random() - .5) * .5;
      const distance = radius * (.85 + Math.random() * .45);
      const spark = document.createElement('span');
      spark.className = `spark${i % 2 ? ' alt' : ''}`;
      spark.style.setProperty('--dx', `${(Math.cos(angle) * distance).toFixed(1)}px`);
      spark.style.setProperty('--dy', `${(Math.sin(angle) * distance).toFixed(1)}px`);
      add(spark);
    }
  }
  let pointerFired = false;
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    fire();
    pointerFired = true;
  });
  button.addEventListener('pointercancel', () => { pointerFired = false; });
  button.addEventListener('click', event => {
    if (!pointerFired || event.detail === 0) fire();
    pointerFired = false;
  });
  return fire;
}
