import { localClock } from './lib.js';
import { validSchedule, slotsForDay, toTime } from '../routine-schedule.js';

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
    typeof value.enabled === 'boolean' && (value.schedule === undefined || value.schedule === null || validSchedule(value.schedule));
}

export function exposeRoutine(row) {
  const result={ id:row.id, label:row.label, title:row.title, body:row.body,
    time:row.time_local, days:row.days_mask, enabled:Boolean(row.enabled) };
  if (row.schedule_json) {
    const schedule=JSON.parse(row.schedule_json);
    if (validSchedule(schedule)) result.schedule=schedule;
  }
  return result;
}

// Bit 0 = Sunday, 1 = Monday ... 6 = Saturday.
export function latestRoutineSlot(reminder, clocks) {
  if (!reminder.enabled) return null;
  const byDay=new Map();
  for (const clock of clocks) {
    if (!byDay.has(clock.day)) byDay.set(clock.day,new Set(slotsForDay(reminder,clock.day)));
    if (byDay.get(clock.day).has(clock.minutes)) return clock.day+':'+toTime(clock.minutes);
  }
  return null;
}
export function routineSlot(reminder,date,timezone) {
  try { return latestRoutineSlot(reminder,[localClock(date,timezone)]); }
  catch { return null; }
}
