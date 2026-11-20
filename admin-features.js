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
