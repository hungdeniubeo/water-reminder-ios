import { dayKeyOffset } from './logic.js';

// A seven-day window ending today, or 7, 14, ... days before today.
// Dates use the device's local calendar, not UTC or a server.
const FIRST_DAY = '2020-01-01';
export function getWeekWindow(weeksBack = 0, reference = new Date()) {
  const offset = Math.max(0, Math.trunc(Number(weeksBack) || 0));
  const endOffset = -7 * offset;
  const days = Array.from({length: 7}, (_, index) => dayKeyOffset(endOffset - 6 + index, reference));
  const previousEnd = dayKeyOffset(endOffset - 7, reference);
  return { days, canOlder: previousEnd >= FIRST_DAY, canNewer: offset > 0 };
}

export function swipeWeekDirection(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) * 1.35) return 0;
  return dx > 0 ? 1 : -1; // Swipe right = older dates; left = newer dates.
}
