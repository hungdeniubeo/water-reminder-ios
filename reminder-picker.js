/**
 * Beo's animated reminder interval menu. Keep the real <select> as the single
 * source of truth for scheduling, locale changes, backups and offline use.
 * Native iOS select menus cannot be styled or animated by the webpage.
 */
export function setupReminderIntervalPicker() {
  const noop = { sync() {}, close() {} };
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;

  const root = document.getElementById('beo-interval-picker');
  const input = document.getElementById('remind-interval');
  const trigger = document.getElementById('beo-interval-trigger');
  const label = document.getElementById('beo-interval-value');
  const menu = document.getElementById('beo-interval-menu');
  if (!root || !input || !trigger || !label || !menu) return noop;

  const choices = [...menu.querySelectorAll('.beo-interval-option')];
  if (!choices.length) return noop;
  const parentForm = root.closest('form');
  let expanded = false;
  let activeIndex = 0;
  let closeTimer = null;

  const reduceMotion = () => typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function focusSafely(node) {
    try { node.focus({ preventScroll: true }); }
    catch { node.focus(); }
  }

  function sync() {
    const selected = choices.find(item => item.dataset.interval === input.value) || choices[0];
    label.textContent = selected.querySelector('.beo-option-text').textContent.trim();
    for (const choice of choices) {
      choice.setAttribute('aria-selected', String(choice.dataset.interval === input.value));
    }
  }

  function setActive(index) {
    activeIndex = (index + choices.length) % choices.length;
    for (let i = 0; i < choices.length; i++) {
      choices[i].classList.toggle('is-highlighted', i === activeIndex);
    }
    menu.setAttribute('aria-activedescendant', choices[activeIndex].id);
  }

  function close(restoreFocus = false) {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    expanded = false;
    root.classList.remove('is-open', 'drop-up');
    parentForm?.classList.remove('beo-interval-layer');
    trigger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    choices.forEach(item => item.classList.remove('beo-confirmed', 'is-highlighted'));
    if (restoreFocus) focusSafely(trigger);
  }

  function open() {
    if (expanded) return;
    sync();
    const rect = trigger.getBoundingClientRect();
    const view = window.visualViewport;
    const top = view?.offsetTop ?? 0;
    const bottom = top + (view?.height ?? window.innerHeight);
    const down = bottom - rect.bottom - 14;
    const up = rect.top - top - 14;
    const height = menu.offsetHeight || 240;
    root.classList.toggle('drop-up', down < height + 12 && up > down);

    expanded = true;
    parentForm?.classList.add('beo-interval-layer');
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    menu.inert = false;
    setActive(Math.max(0, choices.findIndex(item => item.dataset.interval === input.value)));
    focusSafely(menu);
  }

  function choose(option, keyboard = false) {
    if (!expanded || !option || closeTimer !== null) return;
    const previous = input.value;
    input.value = option.dataset.interval;
    sync();
    setActive(choices.indexOf(option));
    option.classList.add('beo-confirmed');
    if (previous !== input.value) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Give the tiny "picked" sparkle a moment to play before dismissal.
    if (reduceMotion()) {
      close(keyboard);
    } else {
      closeTimer = window.setTimeout(() => close(keyboard), 185);
    }
  }

  trigger.addEventListener('click', () => expanded ? close(true) : open());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
      setActive(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    }
  });

  menu.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : choices.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(choices[activeIndex], true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      // Keep keyboard navigation predictable even though this is a popup.
      event.preventDefault();
      close();
      const destination = event.shiftKey
        ? document.getElementById('remind-end')
        : parentForm?.querySelector('button[type="submit"]');
      if (destination) focusSafely(destination);
    }
  });

  choices.forEach(choice => choice.addEventListener('click', () => choose(choice)));
  input.addEventListener('change', sync);
  document.addEventListener('pointerdown', event => {
    if (expanded && !root.contains(event.target)) close();
  }, { passive: true });
  document.addEventListener('focusin', event => {
    if (expanded && !root.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (expanded && !event.defaultPrevented && event.key === 'Escape') close(true);
  });

  // Only replace the native control once the custom interactions are ready.
  sync();
  trigger.hidden = false;
  root.classList.add('beo-enhanced');
  return { sync, close };
}
