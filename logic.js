// Pure state and date helpers. No network, browser, or storage dependencies.
export const STORAGE_KEY = 'water-reminder-state-v1';
export const DEFAULT_GOAL = 2000;
const INTERVAL_OPTIONS = [60, 90, 120, 180];
const isValidTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

export function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function dayKeyOffset(offset, from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return localDayKey(date);
}

export function normalizeState(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const goal = Number(raw.goal);
  const data = {
    goal: Number.isInteger(goal) && goal >= 500 && goal <= 6000 ? goal : DEFAULT_GOAL,
    reminder: { enabled: false, start: '09:00', end: '21:00', interval: 120 },
    lastReminderSlot: typeof raw.lastReminderSlot === 'string' ? raw.lastReminderSlot.slice(0, 40) : '',
    logs: []
  };

  const reminder = raw.reminder && typeof raw.reminder === 'object' ? raw.reminder : {};
  const start = isValidTime(reminder.start) ? reminder.start : '09:00';
  const end = isValidTime(reminder.end) ? reminder.end : '21:00';
  data.reminder = {
    enabled: reminder.enabled === true,
    start: toMinutes(start) < toMinutes(end) ? start : '09:00',
    end: toMinutes(start) < toMinutes(end) ? end : '21:00',
    interval: INTERVAL_OPTIONS.includes(Number(reminder.interval)) ? Number(reminder.interval) : 120
  };

  if (Array.isArray(raw.logs)) {
    data.logs = raw.logs.filter(log => {
      if (!log || typeof log !== 'object') return false;
      const amount = Number(log.amount);
      const date = new Date(log.at);
      return typeof log.id === 'string' && log.id.length > 0 && log.id.length < 120 &&
        Number.isInteger(amount) && amount >= 20 && amount <= 2000 &&
        Number.isFinite(date.getTime()) &&
        typeof log.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(log.day);
    }).slice(-5000).map(log => ({
      id: log.id,
      amount: Number(log.amount),
      at: new Date(log.at).toISOString(),
      day: log.day
    }));
  }
  return data;
}

// Reset only water intake. Keep goals, reminder settings and other fields intact.
export function clearWaterLogs(current) {
  return { ...current, logs: [] };
}

export function totalForDay(logs, day) {
  return logs.reduce((sum, log) => sum + (log.day === day ? log.amount : 0), 0);
}

export function getWeekStats(logs, goal, today = new Date()) {
  const days = [];
  for (let offset = -6; offset <= 0; offset++) {
    const day = dayKeyOffset(offset, today);
    days.push({ day, amount: totalForDay(logs, day), today: offset === 0 });
  }
  const total = days.reduce((sum, item) => sum + item.amount, 0);
  return {
    days,
    average: Math.round(total / 7),
    reached: days.filter(item => item.amount >= goal).length
  };
}

export function nextReminderSlot(now, reminder, lastSlot) {
  if (!reminder || !reminder.enabled || !isValidTime(reminder.start) || !isValidTime(reminder.end)) return null;
  const interval = Number(reminder.interval);
  if (!INTERVAL_OPTIONS.includes(interval)) return null;
  const minute = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(reminder.start);
  const end = toMinutes(reminder.end);
  if (start >= end || minute < start || minute > end) return null;
  const elapsed = minute - start;
  if (elapsed % interval !== 0) return null;
  const slot = localDayKey(now) + ':' + String(minute);
  return slot === lastSlot ? null : slot;
}
