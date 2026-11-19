import {
  STORAGE_KEY, normalizeState, localDayKey, dayKeyOffset,
  totalForDay, getWeekStats, nextReminderSlot
} from './logic.js';
import { getLanguage, setLanguage, translate, applyTranslations, formatNumber, formatDate, formatTime as localizedTime } from './i18n.js';

let language = getLanguage();
const t = (key, vars) => translate(key, language, vars);
const el = id => document.getElementById(id);
const comma = number => formatNumber(number, language);
const ml = number => comma(number) + ' ml';
const formatTime = date => localizedTime(date, language);
const dateForKey = day => new Date(day + 'T12:00:00');

function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeState(saved ? JSON.parse(saved) : null);
  } catch {
    return normalizeState(null);
  }
}

let state = readState();
let openScreen = 'today';
let renderedDay = localDayKey();
let toastTimer = null;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showToast(t('storageProblem'));
    return false;
  }
}

function showToast(message, undo = null) {
  clearTimeout(toastTimer);
  el('toast-message').textContent = message;
  const action = el('toast-action');
  action.hidden = !undo;
  action.onclick = undo ? () => {
    action.hidden = true;
    undo();
  } : null;
  el('toast').hidden = false;
  toastTimer = setTimeout(() => { el('toast').hidden = true; }, undo ? 5200 : 3200);
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
}

function addWater(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 20 || amount > 2000) {
    showToast(t('amountInvalid'));
    return false;
  }
  const at = new Date();
  state.logs.push({ id: makeId(), amount, at: at.toISOString(), day: localDayKey(at) });
  persist();
  render();
  showToast(t('waterAdded', { amount: comma(amount) }));
  return true;
}

function removeWater(id) {
  const index = state.logs.findIndex(item => item.id === id);
  if (index === -1) return;
  const removed = state.logs.splice(index, 1)[0];
  persist();
  render();
  showToast(t('entryRemoved'), () => {
    if (!state.logs.some(item => item.id === removed.id)) state.logs.push(removed);
    persist();
    render();
    showToast(t('entryRestored'));
  });
}

function createDroplet() {
  const wrapper = document.createElement('span');
  wrapper.className = 'entry-icon';
  wrapper.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C9 7 5.5 10.6 5.5 15a6.5 6.5 0 1 0 13 0C18.5 10.6 15 7 12 2.5Z"/></svg>';
  return wrapper;
}

function renderToday() {
  const today = localDayKey();
  const logs = state.logs.filter(item => item.day === today).sort((a, b) => b.at.localeCompare(a.at));
  const total = totalForDay(logs, today);
  const percent = Math.round(total / state.goal * 100);
  const shownPercent = Math.min(percent, 100);
  const now = new Date();

  el('today-date').textContent = formatDate(now, language, { weekday: 'long', month: 'long', day: 'numeric' }).toLocaleUpperCase(language === 'vi' ? 'vi-VN' : 'en-US');
  el('today-total').textContent = comma(total);
  el('today-goal-label').textContent = t('goalOf', { amount: comma(state.goal) });
  el('progress-ring').style.setProperty('--progress', shownPercent + '%');
  el('progress-ring').setAttribute('aria-valuenow', String(shownPercent));
  el('progress-ring').setAttribute('aria-valuetext', ml(total) + ' / ' + ml(state.goal));
  el('progress-status-label').textContent = t(percent >= 100 ? 'goalReached' : 'onYourWay');
  el('progress-message').textContent = t(percent >= 100 ? 'reachedToday' : percent >= 50 ? 'halfWay' : total > 0 ? 'startingWell' : 'startFresh');
  el('progress-remaining').textContent = percent >= 100 ? t('completed') : t('remaining', { amount: comma(state.goal - total) });
  el('today-count').textContent = t('entryCount', { count: logs.length }).toLocaleUpperCase(language === 'vi' ? 'vi-VN' : 'en-US');

  const list = el('today-entries');
  list.replaceChildren();
  if (!logs.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-card';
    const title = document.createElement('strong');
    const body = document.createElement('p');
    title.textContent = t('emptyTitle');
    body.textContent = t('emptyDescription');
    empty.append(title, body);
    list.append(empty);
    return;
  }

  logs.forEach(log => {
    const row = document.createElement('li');
    row.className = 'entry-item';
    const content = document.createElement('span');
    content.className = 'entry-text';
    const label = document.createElement('strong');
    label.textContent = ml(log.amount);
    const time = document.createElement('small');
    time.textContent = formatTime(new Date(log.at));
    content.append(label, time);
    const remove = document.createElement('button');
    remove.className = 'delete-button';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', t('removeEntry', { amount: comma(log.amount), time: time.textContent }));
    remove.addEventListener('click', () => removeWater(log.id));
    row.append(createDroplet(), content, remove);
    list.append(row);
  });
}

function renderHistory() {
  const stats = getWeekStats(state.logs, state.goal, new Date());
  el('week-average').textContent = ml(stats.average);
  el('days-reached').textContent = t('daysCount', { count: stats.reached });

  const bars = el('week-bars');
  bars.replaceChildren();
  stats.days.forEach(day => {
    const column = document.createElement('div');
    column.className = 'bar-col' + (day.today ? ' today' : '');
    const track = document.createElement('div');
    track.className = 'bar-track';
    track.title = day.day + ': ' + ml(day.amount);
    track.setAttribute('aria-label', day.day + ', ' + ml(day.amount));
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.height = (day.amount ? Math.max(6, Math.min(100, day.amount / state.goal * 100)) : 0) + '%';
    track.append(fill);
    const weekday = document.createElement('span');
    weekday.className = 'bar-day';
    weekday.textContent = language === 'vi' ? ['CN','T2','T3','T4','T5','T6','T7'][dateForKey(day.day).getDay()] : ['Su','Mo','Tu','We','Th','Fr','Sa'][dateForKey(day.day).getDay()];
    column.append(track, weekday);
    bars.append(column);
  });

  const history = el('history-days');
  history.replaceChildren();
  for (let offset = 0; offset > -14; offset--) {
    const day = dayKeyOffset(offset);
    const amount = totalForDay(state.logs, day);
    const row = document.createElement('div');
    row.className = 'history-day-row';
    const info = document.createElement('span');
    info.className = 'history-day-name';
    info.textContent = offset === 0 ? t('today') : offset === -1 ? t('yesterday') : formatDate(dateForKey(day), language, { weekday: 'long' });
    const date = document.createElement('small');
    date.textContent = formatDate(dateForKey(day), language, { month: 'short', day: 'numeric' });
    info.append(date);
    const total = document.createElement('strong');
    total.textContent = ml(amount);
    row.append(info, total);
    if (amount >= state.goal) {
      const check = document.createElement('span');
      check.className = 'goal-mark';
      check.setAttribute('aria-label', t('reachedAria'));
      check.title = t('reachedAria');
      check.textContent = '✓';
      row.append(check);
    }
    history.append(row);
  }
}

function formatClock(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatTime(date);
}

function updateReminderPreview() {
  const start = el('remind-start').value;
  const end = el('remind-end').value;
  const interval = Number(el('remind-interval').value);
  if (!start || !end || start >= end) {
    el('reminder-preview').textContent = t('previewInvalid');
    return;
  }
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const times = [];
  for (let minute = startMinutes; minute <= endMinutes && times.length < 4; minute += interval) {
    times.push(formatClock(String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')));
  }
  el('reminder-preview').textContent = t('preview', { times: times.join(', '), more: startMinutes + interval * 4 <= endMinutes ? ' …' : '' });
}

function renderSettings() {
  el('goal-input').value = String(state.goal);
  el('remind-enabled').checked = state.reminder.enabled;
  el('remind-start').value = state.reminder.start;
  el('remind-end').value = state.reminder.end;
  el('remind-interval').value = String(state.reminder.interval);
  updateReminderPreview();
}

function render() {
  renderToday();
  renderHistory();
  renderedDay = localDayKey();
}

function changeScreen(screen) {
  if (!['today', 'history', 'settings'].includes(screen)) return;
  openScreen = screen;
  ['today', 'history', 'settings'].forEach(name => {
    el('screen-' + name).hidden = name !== screen;
  });
  document.querySelectorAll('[data-tab]').forEach(button => {
    const isActive = button.dataset.tab === screen;
    button.classList.toggle('active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (screen === 'settings') renderSettings();
  if (screen === 'history') renderHistory();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
function closeDialog(dialog) {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function checkReminder() {
  if (document.visibilityState === 'hidden') return;
  const slot = nextReminderSlot(new Date(), state.reminder, state.lastReminderSlot);
  if (!slot) return;
  state.lastReminderSlot = slot;
  persist();
  showToast(t('reminderToast'));
}

document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('click', () => changeScreen(button.dataset.tab));
});

// Language changes are immediate and independent of the hydration data backup.
document.querySelectorAll('[data-lang]').forEach(button => {
  button.addEventListener('click', () => {
    if (language === button.dataset.lang) return;
    if (!setLanguage(button.dataset.lang)) return;
    language = button.dataset.lang;
    applyTranslations(language);
    el('toast').hidden = true;
    render();
    renderSettings();
  });
});
document.querySelectorAll('[data-add]').forEach(button => {
  button.addEventListener('click', () => addWater(button.dataset.add));
});

el('open-log').addEventListener('click', () => showDialog(el('log-dialog')));
el('close-dialog').addEventListener('click', () => closeDialog(el('log-dialog')));
el('about-button').addEventListener('click', () => showDialog(el('about-dialog')));
el('close-about').addEventListener('click', () => closeDialog(el('about-dialog')));
el('got-it').addEventListener('click', () => closeDialog(el('about-dialog')));

document.querySelectorAll('[data-preset]').forEach(button => {
  button.addEventListener('click', () => {
    el('amount-input').value = button.dataset.preset;
    document.querySelectorAll('[data-preset]').forEach(item => item.classList.toggle('selected', item === button));
  });
});
el('amount-input').addEventListener('input', () => {
  document.querySelectorAll('[data-preset]').forEach(item => {
    item.classList.toggle('selected', item.dataset.preset === el('amount-input').value);
  });
});
el('drink-form').addEventListener('submit', event => {
  event.preventDefault();
  if (addWater(el('amount-input').value)) {
    closeDialog(el('log-dialog'));
    el('amount-input').value = '250';
    document.querySelectorAll('[data-preset]').forEach(item => item.classList.toggle('selected', item.dataset.preset === '250'));
  }
});
el('goal-form').addEventListener('submit', event => {
  event.preventDefault();
  const goal = Number(el('goal-input').value);
  if (!Number.isInteger(goal) || goal < 500 || goal > 6000) {
    showToast(t('goalInvalid'));
    return;
  }
  state.goal = goal;
  persist();
  render();
  showToast(t('goalUpdated'));
});
['remind-start', 'remind-end', 'remind-interval'].forEach(id => {
  el(id).addEventListener('change', updateReminderPreview);
});
el('reminder-form').addEventListener('submit', event => {
  event.preventDefault();
  const start = el('remind-start').value;
  const end = el('remind-end').value;
  if (!start || !end || start >= end) {
    showToast(t('timeInvalid'));
    return;
  }
  state.reminder = {
    enabled: el('remind-enabled').checked,
    start, end,
    interval: Number(el('remind-interval').value)
  };
  state.lastReminderSlot = '';
  persist();
  updateReminderPreview();
  showToast(t(state.reminder.enabled ? 'remindersSaved' : 'remindersOff'));
});


function exportBackup() {
  const payload = { format: 'water-reminder-backup', version: 1, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'water-reminder-backup-' + localDayKey() + '.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast(t('backupReady'));
}

async function restoreBackup(file) {
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error(t('backupTooLarge'));
    const payload = JSON.parse(await file.text());
    if (payload.format !== 'water-reminder-backup' || payload.version !== 1 ||
        !payload.data || !Array.isArray(payload.data.logs)) throw new Error(t('backupInvalid'));
    if (!window.confirm(t('backupConfirm'))) return;
    state = normalizeState(payload.data);
    persist();
    render();
    renderSettings();
    showToast(t('backupRestored'));
  } catch (error) {
    showToast(error.message || t('backupFailed'));
  }
}

el('export-backup').addEventListener('click', exportBackup);
el('import-backup').addEventListener('click', () => el('backup-file').click());
el('backup-file').addEventListener('change', async () => {
  const file = el('backup-file').files[0];
  await restoreBackup(file);
  el('backup-file').value = '';
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (localDayKey() !== renderedDay) render();
    checkReminder();
  }
});
setInterval(() => {
  if (document.hidden) return;
  if (localDayKey() !== renderedDay) render();
  checkReminder();
}, 30_000);

applyTranslations(language);
render();
renderSettings();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // Online mode remains usable if service workers are unavailable.
    });
  });
}
