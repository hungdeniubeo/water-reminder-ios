export const MIN_INTERVAL = 5;
export const MAX_INTERVAL = 720;

/** Preview exactly the daily start + interval schedule used by the Worker. */
export function previewScheduleTimes(start, end, interval) {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const minutes = Number(interval);
  if (!time.test(start || '') || !time.test(end || '') || start >= end ||
      !Number.isInteger(minutes) || minutes < 5 || minutes > 720) return [];
  const parse = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const pad = n => String(n).padStart(2, '0');
  const output = [];
  for (let tick = parse(start); tick <= parse(end); tick += minutes) {
    output.push(pad(Math.floor(tick / 60)) + ':' + pad(tick % 60));
  }
  return output;
}

/** Next reminders are a UI preview, never a delivery receipt or a promise of push arrival. */
export function upcomingReminders(settings, routines = [], now = new Date(), limit = 3) {
  if (!settings || !Number.isFinite(now.getTime())) return [];
  const timezone = settings.timezone || 'Asia/Ho_Chi_Minh';
  let local;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    local = {day: `${value.year}-${value.month}-${value.day}`, minute: Number(value.hour) * 60 + Number(value.minute)};
  } catch { return []; }
  const start = new Date(local.day + 'T00:00:00.000Z');
  const candidates = [];
  const water = settings.enabled ? previewScheduleTimes(settings.start, settings.end, settings.interval) : [];
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  const asMinutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(start.getTime() + offset * 86400000);
    const weekday = day.getUTCDay();
    const weekdayLabel = ['CN','T2','T3','T4','T5','T6','T7'][weekday];
    const prefix = offset === 0 ? 'Hôm nay' : offset === 1 ? 'Ngày mai' : weekdayLabel;
    for (const routine of routines) {
      if (!routine?.enabled || !(Number(routine.days) & (1 << weekday)) || !validTime.test(routine.time || '')) continue;
      if (offset === 0 && asMinutes(routine.time) <= local.minute) continue;
      candidates.push({title:routine.label, time:routine.time, when:`${prefix} · ${routine.time}`, offset, minute:asMinutes(routine.time),kind:'routine'});
    }
    // One upcoming slot represents the repeated series without hiding all daily tasks.
    const firstWater = water.find(time => offset > 0 || asMinutes(time) > local.minute);
    if (firstWater) candidates.push({title:'Nhắc lặp trong ngày', time:firstWater, when:`${prefix} · ${firstWater}`, offset, minute:asMinutes(firstWater),kind:'repeated'});
    // No need to generate hundreds of scheduled slots after enough candidates exist.
    if (candidates.length >= limit && offset >= 1) break;
  }
  candidates.sort((a,b) => a.offset - b.offset || a.minute - b.minute || a.title.localeCompare(b.title,'vi'));
  return candidates.slice(0, Math.max(0,limit));
}
