/** A small 24-hour time selector. Native time inputs remain the source of truth. */
export function parseTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function makeTime(hour, minute) {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

const icon = (doc, text, className) => {
  const el = doc.createElement('span');
  el.className = className;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  return el;
};

const action = (doc, text, className, handler) => {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', handler);
  return button;
};

/** Progressive enhancement: without JS, the original OS time inputs still work. */
export function setupTimePickers(doc = globalThis.document) {
  if (!doc?.querySelector || !doc?.createElement || !doc?.body) return {sync() {}};

  const fields = [
    {id:'schedule-start', label:'Chọn giờ bắt đầu'},
    {id:'schedule-end', label:'Chọn giờ kết thúc'},
    {id:'routine-time', label:'Chọn giờ gửi'},
    {id:'routine-start', label:'Chọn giờ bắt đầu lời nhắc'},
    {id:'routine-end', label:'Chọn giờ kết thúc lời nhắc'}
  ];
  const entries = new Map();
  let active = null;
  const backdrop = doc.createElement('div');
  backdrop.className = 'time-picker-backdrop';
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden', 'true');
  doc.body.append(backdrop);

  const dismiss = (restoreFocus = true) => {
    if (!active) return;
    const {panel, trigger} = active;
    panel.hidden = true;
    backdrop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    active = null;
    if (restoreFocus) trigger.focus({preventScroll:true});
  };
  backdrop.addEventListener('click', () => dismiss(false));

  function placePanel(entry) {
    if (!active || active !== entry) return;
    const {panel, trigger} = entry;
    if (globalThis.matchMedia?.('(max-width: 600px)')?.matches) {
      panel.style.left = '';
      panel.style.top = '';
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const width = box.width || 310;
    const height = box.height || 340;
    const x = Math.max(12, Math.min(rect.left, innerWidth - width - 12));
    let y = rect.bottom + 9;
    if (y + height > innerHeight - 12) y = rect.top - height - 9;
    if (y < 12) y = Math.max(12, Math.round((innerHeight - height) / 2));
    panel.style.left = Math.round(x) + 'px';
    panel.style.top = Math.round(y) + 'px';
  }
  globalThis.addEventListener?.('resize', () => { if (active) placePanel(active); });
  globalThis.addEventListener?.('scroll', () => { if (active) placePanel(active); }, true);
  doc.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
    if (event.key !== 'Tab') return;
    const focusables = [...active.panel.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  for (const {id, label} of fields) {
    const input = doc.getElementById(id);
    if (!input || input.type !== 'time' || !input.parentNode) continue;
    const wrapper = doc.createElement('div');
    wrapper.className = 'time-control';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input);

    const trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.id = 'time-trigger-' + id;
    trigger.className = 'time-display';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'time-picker-' + id);
    trigger.append(icon(doc, '◷', 'time-display-icon'));
    const readout = doc.createElement('span');
    readout.className = 'time-display-value';
    trigger.append(readout, icon(doc, '⌄', 'time-display-arrow'));
    wrapper.append(trigger);

    const panel = doc.createElement('section');
    panel.className = 'time-picker-panel';
    panel.id = 'time-picker-' + id;
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-label', label);
    panel.setAttribute('aria-modal', 'true');
    panel.hidden = true;
    const heading = doc.createElement('div');
    heading.className = 'time-picker-heading';
    const intro = doc.createElement('div');
    intro.append(icon(doc, 'CHỌN THỜI GIAN', 'time-picker-kicker'));
    const title = doc.createElement('strong');
    title.textContent = label;
    intro.append(title);
    const close = action(doc, '×', 'time-picker-close', () => dismiss());
    close.setAttribute('aria-label','Đóng bộ chọn giờ');
    heading.append(intro,close);
    panel.append(heading);

    const layout = doc.createElement('div');
    layout.className = 'time-picker-inputs';
    const field = (caption, max) => {
      const wrap = doc.createElement('label');
      wrap.className = 'time-picker-field';
      const hint = doc.createElement('span'); hint.textContent = caption;
      const edit = doc.createElement('input');
      edit.type = 'text'; edit.inputMode = 'numeric'; edit.maxLength = 2;
      edit.autocomplete = 'off'; edit.spellcheck = false;
      edit.pattern = '[0-9]{1,2}';
      edit.setAttribute('aria-label', caption + ' từ 00 đến ' + max);
      wrap.append(hint,edit);
      return {wrap,edit};
    };
    const hours = field('Giờ', '23');
    const minutes = field('Phút', '59');
    layout.append(hours.wrap,icon(doc, ':', 'time-picker-colon'), minutes.wrap);
    panel.append(layout);

    const quick = doc.createElement('div');
    quick.className = 'time-picker-quick';
    const quickLabel = doc.createElement('span');
    quickLabel.textContent = 'Chọn nhanh phút';
    quick.append(quickLabel);
    const chips = doc.createElement('div');
    chips.className = 'time-picker-chips';
    const minuteChips = [];
    const markChips = () => minuteChips.forEach(b => b.classList.toggle('selected', b.textContent === minutes.edit.value.padStart(2, '0')));
    for (const minute of ['00','15','30','45']) {
      const chip = action(doc, minute, 'time-minute-chip', () => {
        minutes.edit.value = minute;
        markChips();
      });
      chip.setAttribute('aria-label','Chọn phút ' + minute);
      minuteChips.push(chip);
      chips.append(chip);
    }
    quick.append(chips);
    panel.append(quick);

    const error = doc.createElement('p');
    error.className = 'time-picker-error';
    error.setAttribute('role','status');
    panel.append(error);
    const footer = doc.createElement('div');
    footer.className = 'time-picker-actions';
    const cancel = action(doc,'Hủy','time-picker-cancel',()=>dismiss());
    const apply = action(doc,'Áp dụng','time-picker-apply',() => {
      const value = makeTime(hours.edit.value, minutes.edit.value);
      if (!value || !/^\d{1,2}$/.test(hours.edit.value) || !/^\d{1,2}$/.test(minutes.edit.value)) {
        error.textContent = 'Nhập giờ từ 00–23 và phút từ 00–59.';
        hours.edit.setAttribute('aria-invalid', String(!(Number(hours.edit.value) >= 0 && Number(hours.edit.value) <= 23)));
        minutes.edit.setAttribute('aria-invalid', String(!(Number(minutes.edit.value) >= 0 && Number(minutes.edit.value) <= 59)));
        return;
      }
      input.value = value;
      sync();
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      dismiss();
    });
    footer.append(cancel,apply);
    panel.append(footer);
    doc.body.append(panel);

    const sync = () => {
      readout.textContent = parseTime(input.value) ? input.value : '--:--';
      trigger.setAttribute('aria-label', label + ', ' + readout.textContent);
    };
    const open = () => {
      if (active) dismiss(false);
      const time = parseTime(input.value) || {hour:12, minute:0};
      hours.edit.value = String(time.hour).padStart(2, '0');
      minutes.edit.value = String(time.minute).padStart(2, '0');
      hours.edit.removeAttribute('aria-invalid');
      minutes.edit.removeAttribute('aria-invalid');
      error.textContent = '';
      markChips();
      active = entry;
      panel.hidden = false;
      backdrop.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      placePanel(entry);
      hours.edit.focus({preventScroll:true});
      hours.edit.select();
    };
    const entry = { id, panel, trigger, sync };
    trigger.addEventListener('click', open);
    for (const edit of [hours.edit,minutes.edit]) {
      edit.addEventListener('input', () => { error.textContent = ''; edit.removeAttribute('aria-invalid'); markChips(); });
      edit.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); apply.click(); }
      });
    }
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    input.addEventListener('invalid', event => { event.preventDefault(); open(); });
    const linkedLabel = doc.querySelector('label[for="' + id + '"]');
    if (linkedLabel) linkedLabel.htmlFor = trigger.id;
    input.classList.add('time-source-hidden');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    sync();
    entries.set(id, entry);
  }

  return { sync(id) {
    if (id) entries.get(id)?.sync();
    else for (const entry of entries.values()) entry.sync();
  }};
}
