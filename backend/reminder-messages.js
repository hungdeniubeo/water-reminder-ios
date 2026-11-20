/** A rotating, affectionate note for each scheduled reminder.
 * Custom copy from Settings always overrides the automatic rotation.
 * Rotation depends only on local calendar date and schedule slot, never on water data.
 */
import { localClock } from './lib.js';

export const REMINDER_TITLES = Object.freeze([
  'NHẮC BEO UỐNG NƯỚC MỖI NGÀY ♡',
  'CỤC CƯNG ƠI, EM UỐNG NƯỚC CHƯA?',
  'BÉ ƠI, TỚI GIỜ UỐNG NƯỚC RỒI ♡',
  'MỘT CHÚT NƯỚC CHO BEO NÈ',
  'BEO YÊU, NGHỈ TAY CHÚT NHA ♡',
  'ANH NHẮC BÉ UỐNG NƯỚC NÈ',
  'HÔM NAY BEO UỐNG NƯỚC CHƯA?',
  'UỐNG NƯỚC CÙNG ANH NHA ♡',
  'THƯƠNG BEO, NHỚ UỐNG NƯỚC',
  'ĐẾN GIỜ CHĂM BẢN THÂN RỒI ♡',
  'LẠI LÀ ANH NHẮC BEO NÈ',
  'MỘT NGỤM NƯỚC CHO CỤC CƯNG ♡'
]);
export function selectReminderTitle(slot = '') {
  let hash = 0;
  for (const char of String(slot)) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return REMINDER_TITLES[hash % REMINDER_TITLES.length];
}
export const REMINDER_MESSAGES = Object.freeze({
  vi: Object.freeze([
    "Nhớ uống nước đầy đủ nha em ♡",
    "Cục zàng ơi, mình uống nước cùng anh nha ♡",
    "Beo yêu ơi, đến giờ uống chút nước rồi nè ♡",
    "Anh nhắc nhẹ thôi, Beo nhớ uống nước đó nha ♡",
    "Thương Beo nè, uống một ngụm nước nha ♡",
    "Bé ơi, nghỉ tay một chút rồi uống nước nha ♡",
    "Beo ơi, mình uống một ly nước nhỏ nhé ♡",
    "Beo của anh ơi, nhớ uống nước đều nha ♡",
    "Cục cưng ơi, chăm sóc mình một chút nha ♡",
    "Beo ơi, mình uống thêm một ngụm nước nhé ♡",
    "Beo thương ơi, anh gửi em lời nhắc uống nước ♡",
    "Đang bận cũng nhớ uống nước nha em ♡",
    "Beo iu ơi, một chút nước cho ngày dịu dàng nha ♡",
    "Có anh nhắc nè, bé uống nước chút nha ♡",
    "Beo ơi, nhớ để ly nước gần mình nha em ♡",
    "Em bé của anh ơi, nhớ uống nước nha ♡",
    "Beo à, cùng chăm mình bằng một ly nước nhé ♡",
    "Một lời nhắc nhỏ cho Beo: uống nước nha ♡",
    "Beo yêu, anh mong em nhớ uống nước đều nè ♡",
    "Beo ơi, uống chút nước rồi nghỉ ngơi nhé ♡",
    "Cục zàng à, anh nhắc em uống nước nè ♡",
    "Beo ơi, em dành một phút uống nước nha ♡",
    "Thương em nên anh nhắc, uống chút nước nha Beo ♡",
    "Bé yêu ơi, cùng uống nước một chút nhé ♡"
  ]),
  en: Object.freeze([
    "Beo, love, remember to take a little sip ♡",
    "My darling Beo, let's have some water ♡",
    "My love, it's time for a gentle water break ♡",
    "A little reminder from me: have some water ♡",
    "Thinking of you, Beo. Have a little water ♡",
    "Sweetheart, take a little break and sip ♡",
    "Beo, how about a little glass of water? ♡",
    "My sweet Beo, remember your water today ♡",
    "Darling, take a little moment for yourself ♡",
    "Beo, shall we have another little sip? ♡",
    "Sending you a gentle reminder to sip, Beo ♡",
    "Even on a busy day, remember your water ♡",
    "A little water for a lovely day, my Beo ♡",
    "Just me reminding you to have a little sip ♡",
    "Beo, keep your water close by, love ♡",
    "My sweet girl, don't forget to sip ♡",
    "Beo, let's look after you one sip at a time ♡",
    "A tiny note for Beo: a water break, love ♡",
    "My love, remember to drink a little water ♡",
    "Beo, take a sip and a little breather ♡",
    "Darling Beo, a soft reminder from me ♡",
    "Beo, take one little minute for some water ♡",
    "Because I care, here's a little sip reminder ♡",
    "Sweet Beo, let's have a little water together ♡"
  ])
});

const asMinutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
  : null;

export function selectReminderMessage(device, { slot = '', testAt = null, now = new Date() } = {}) {
  const custom = typeof device?.note_to_partner === 'string' ? device.note_to_partner.trim() : '';
  if (custom) return custom;
  const language = device?.lang === 'en' ? 'en' : 'vi';
  const messages = REMINDER_MESSAGES[language];

  // A test notification is intentionally a different message on the next
  // allowed test (the API permits a new test once every 120 seconds).
  let sequence;
  if (Number.isInteger(testAt) && testAt >= 0) {
    sequence = Math.floor(testAt / 120);
  } else {
    const local = /^\d{4}-\d{2}-\d{2}:\d+$/.test(slot)
      ? { day: slot.slice(0, 10), minutes: Number(slot.slice(11)) }
      : localClock(now, device?.timezone || 'Asia/Ho_Chi_Minh');
    const start = asMinutes(device?.start_time) ?? 540;
    const end = asMinutes(device?.end_time) ?? 1260;
    const interval = [60, 90, 120, 180].includes(Number(device?.interval_minutes))
      ? Number(device.interval_minutes) : 120;
    const slotsPerDay = Math.max(1, Math.floor((end - start) / interval) + 1);
    const slotIndex = Math.max(0, Math.min(slotsPerDay - 1, Math.floor((local.minutes - start) / interval)));
    const [year, month, day] = local.day.split('-').map(Number);
    const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
    sequence = dayNumber * slotsPerDay + slotIndex;
  }

  // 7 and 24 are coprime: 24 successive notifications get different texts.
  const index = ((sequence * 7 + 5) % messages.length + messages.length) % messages.length;
  return messages[index];
}
