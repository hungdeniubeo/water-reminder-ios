import { localClock } from './lib.js';

export const MAX_ROUTINES = 20;
export const ROUTINE_ID = /^(?:go-work|lunch|[a-f0-9-]{36})$/;
const printable = (value, limit, multiline = false) => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= limit && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value) &&
  (multiline || !/[\r\n\t]/.test(value));

export function validRoutine(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    printable(value.label, 40) && printable(value.title, 70) &&
    printable(value.body, 150, true) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time || '') &&
    Number.isInteger(value.days) && value.days >= 1 && value.days <= 127 &&
    typeof value.enabled === 'boolean';
}

export function exposeRoutine(row) {
  return { id:row.id, label:row.label, title:row.title, body:row.body,
    time:row.time_local, days:row.days_mask, enabled:Boolean(row.enabled) };
}

// Bit 0 = Sunday, 1 = Monday ... 6 = Saturday.
export function routineSlot(reminder, date, timezone) {
  if (!reminder.enabled) return null;
  try {
    const clock = localClock(date,timezone);
    const weekday = new Date(clock.day + 'T00:00:00Z').getUTCDay();
    const localTime = String(Math.floor(clock.minutes/60)).padStart(2,'0') + ':' +
      String(clock.minutes%60).padStart(2,'0');
    if ((reminder.days & (1 << weekday)) === 0 || reminder.time !== localTime) return null;
    return clock.day + ':' + localTime;
  } catch { return null; }
}
