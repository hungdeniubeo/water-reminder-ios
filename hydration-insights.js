/** Local-only hydration journaling. Results describe *recorded* drinks, not clinical hydration. */
import { dayKeyOffset, localDayKey, totalForDay } from './logic.js';

export const BODY_NOTES_KEY = 'water-reminder-body-notes-v1';
export const BODY_SYMPTOMS = Object.freeze(['thirst', 'dryMouth', 'headache', 'dizziness', 'darkUrine', 'fatigue']);
export const BODY_CONTEXTS = Object.freeze(['hotWeather', 'exercise']);

const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(new Date(day + 'T12:00:00').getTime()) && localDayKey(new Date(day + 'T12:00:00')) === day;

export function cleanBodyNotes(input) {
  const cleaned = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return cleaned;
  for (const [day, note] of Object.entries(input).slice(-1100)) {
    if (!validDay(day) || !note || typeof note !== 'object') continue;
    const symptoms = Array.isArray(note.symptoms) ? note.symptoms.filter(x => BODY_SYMPTOMS.includes(x)) : [];
    const contexts = Array.isArray(note.contexts) ? note.contexts.filter(x => BODY_CONTEXTS.includes(x)) : [];
    if (symptoms.length || contexts.length) cleaned[day] = {
      symptoms: [...new Set(symptoms)], contexts: [...new Set(contexts)]
    };
  }
  return cleaned;
}

/** Returns past complete calendar days only (today is partial and excluded). */
export function completedDaySummary(logs, goal, today = new Date(), length = 7) {
  const records = [];
  for (let offset = -length; offset <= -1; offset++) {
    const day = dayKeyOffset(offset, today);
    const entries = logs.filter(item => item.day === day);
    records.push({ day, total: totalForDay(entries, day), hasLog: entries.length > 0, metGoal: entries.length > 0 && totalForDay(entries, day) >= goal });
  }
  const logged = records.filter(r => r.hasLog);
  const low = logged.filter(r => !r.metGoal);
  return {
    records,
    loggedDays: logged.length,
    missingDays: length - logged.length,
    goalDays: logged.filter(r => r.metGoal).length,
    lowerDays: low.length,
    averageLogged: logged.length ? Math.round(logged.reduce((sum, day) => sum + day.total, 0) / logged.length) : null,
    progressRatio: logged.length ? logged.filter(r => r.metGoal).length / logged.length : null
  };
}

export function recentGoalStreak(logs, goal, today = new Date()) {
  let count = 0;
  // Streak is calculated from yesterday, never penalizing an unfinished today.
  for (let dayOffset = -1; dayOffset >= -366; dayOffset--) {
    if (totalForDay(logs, dayKeyOffset(dayOffset, today)) < goal) break;
    count++;
  }
  return count;
}

export function monthlyCalendar(date = new Date(), today = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1, 12);
  const last = new Date(y, m + 1, 0, 12).getDate();
  const startBlank = (first.getDay() + 6) % 7; // Monday-first.
  const cells = Array.from({ length: startBlank }, () => null);
  for (let i = 1; i <= last; i++) {
    const date = new Date(y, m, i, 12);
    cells.push({ key: localDayKey(date), day: i, future: localDayKey(date) > localDayKey(today) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function dateWithinJournal(key, today = new Date(), earliestYear = 2020) {
  return validDay(key) && key <= localDayKey(today) && key >= earliestYear + '-01-01';
}