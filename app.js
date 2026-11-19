import {
  STORAGE_KEY, normalizeState, localDayKey, dayKeyOffset,
  totalForDay, getWeekStats, nextReminderSlot
} from './logic.js';

const el = id => document.getElementById(id);
const comma = number => Number(number).toLocaleString('en-US');
const ml = number => comma(number) + ' ml';
const formatTime = date => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
    showToast('Storage unavailable. Your changes may not be saved.');
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
    showToast('Enter an amount between 20 and 2,000 ml.');
    return false;
  }
  const at = new Date();
  state.logs.push({ id: makeId(), amount, at: at.toISOString(), day: localDayKey(at) });
  persist();
  render();
  showToast('+' + ml(amount) + ' added. Nice one!');
  return true;
}

function removeWater(id) {
  const index = state.logs.findIndex(item => item.id === id);
  if (index === -1) return;
  const removed = state.logs.splice(index, 1)[0];
  persist();
  render();
  showToast('Entry removed.', () => {
    if (!state.logs.some(item => item.id === removed.id)) state.logs.push(removed);
    persist();
    render();
    showToast('Entry restored.');
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

  el('today-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  el('today-total').textContent = comma(total);
  el('today-goal-label').textContent = 'of ' + ml(state.goal);
  el('progress-ring').style.setProperty('--progress', shownPercent + '%');
  el('progress-ring').setAttribute('aria-valuenow', String(shownPercent));
  el('progress-ring').setAttribute('aria-valuetext', ml(total) + ' of ' + ml(state.goal));
  el('progress-message').textContent = percent >= 100 ? 'Goal reached. Well done!' : percent >= 50 ? 'You are doing great.' : total > 0 ? 'A lovely start.' : 'A fresh start.';
  el('progress-remaining').textContent = percent >= 100 ? 'You have met your goal today.' : ml(state.goal - total) + ' to your goal';
  el('today-count').textContent = String(logs.length) + (logs.length === 1 ? ' ENTRY' : ' ENTRIES');

  const list = el('today-entries');
  list.replaceChildren();
  if (!logs.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-card';
    const title = document.createElement('strong');
    const body = document.createElement('p');
    title.textContent = 'No water logged just yet';
    body.textContent = 'Your first glass is just a tap away.';
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
    remove.setAttribute('aria-label', 'Delete ' + ml(log.amount) + ' entry at ' + time.textContent);
    remove.addEventListener('click', () => removeWater(log.id));
    row.append(createDroplet(), content, remove);
    list.append(row);
  });
}

function renderHistory() {
  const stats = getWeekStats(state.logs, state.goal, new Date());
  el('week-average').textContent = ml(stats.average);
  el('days-reached').textContent = stats.reached + (stats.reached === 1 ? ' day' : ' days');

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
    weekday.textContent = dateForKey(day.day).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
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
    info.textContent = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : dateForKey(day).toLocaleDateString('en-US', { weekday: 'long' });
    const date = document.createElement('small');
    date.textContent = dateForKey(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    info.append(date);
    const total = document.createElement('strong');
    total.textContent = ml(amount);
    row.append(info, total);
    if (amount >= state.goal) {
      const check = document.createElement('span');
      check.className = 'goal-mark';
      check.setAttribute('aria-label', 'Goal reached');
      check.title = 'Goal reached';
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
    el('reminder-preview').textContent = 'Choose a start time earlier than your end time.';
    return;
  }
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const times = [];
  for (let minute = startMinutes; minute <= endMinutes && times.length < 4; minute += interval) {
    times.push(formatClock(String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')));
  }
  el('reminder-preview').textContent = 'Preview: ' + times.join(', ') + (startMinutes + interval * 4 <= endMinutes ? ' …' : '');
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
  window.scrollTo({ top: 0, behavior: 'instant' });
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
  showToast('A little water break? Take a sip.');
}

document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('click', () => changeScreen(button.dataset.tab));
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
    showToast('Choose a goal between 500 and 6,000 ml.');
    return;
  }
  state.goal = goal;
  persist();
  render();
  showToast('Daily goal updated.');
});
['remind-start', 'remind-end', 'remind-interval'].forEach(id => {
  el(id).addEventListener('change', updateReminderPreview);
});
el('reminder-form').addEventListener('submit', event => {
  event.preventDefault();
  const start = el('remind-start').value;
  const end = el('remind-end').value;
  if (!start || !end || start >= end) {
    showToast('End time must be later than start time.');
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
  showToast(state.reminder.enabled ? 'In-app reminders saved.' : 'Reminders turned off.');
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

render();
renderSettings();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // Online mode remains usable if service workers are unavailable.
    });
  });
}
