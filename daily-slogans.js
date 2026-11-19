/** Daily, deterministic love-note headlines for Beo (local calendar date, offline-safe).
 * No tracking, server calls, or storage: a date has one stable headline per language.
 */
export const DAILY_SLOGANS = Object.freeze([
  Object.freeze({ vi: "Beo iu,|uống nước chưa?", en: "Hey Beo, love,|had some water?" }),
  Object.freeze({ vi: "Sáng giờ Beo|uống nước chưa?", en: "Since this morning,|had some water?" }),
  Object.freeze({ vi: "Cục zàng ơi,|nhớ uống nước nha!", en: "Sweet Beo,|don't forget to sip!" }),
  Object.freeze({ vi: "Bé yêu ơi,|uống nước cùng anh!", en: "Hey sweetheart,|sip some water ♡" }),
  Object.freeze({ vi: "Beo xinh ơi,|uống nước đi nè ♡", en: "Lovely Beo,|time for a sip ♡" }),
  Object.freeze({ vi: "Chào bé iu,|nhấp chút nước nha!", en: "Morning, my love,|time for water!" }),
  Object.freeze({ vi: "Beo của anh,|nhớ uống nước nha.", en: "My dear Beo,|remember to hydrate." }),
  Object.freeze({ vi: "Beo bé bỏng,|một ngụm thôi nha!", en: "My little Beo,|just one more sip!" }),
  Object.freeze({ vi: "Ê Beo ơi,|uống nước với anh!", en: "Beo, hey Beo,|let's drink water!" }),
  Object.freeze({ vi: "Giờ này Beo|đã uống nước chưa?", en: "Hey my love,|had water yet?" }),
  Object.freeze({ vi: "Bé ngoan ơi,|uống chút nước nè!", en: "Sweetheart,|take a little sip!" }),
  Object.freeze({ vi: "Một ly nhỏ,|một ngày thật xinh.", en: "One little glass,|one lovely day." }),
  Object.freeze({ vi: "Uống nước đi,|cục zàng của anh!", en: "Have some water,|my darling Beo!" }),
  Object.freeze({ vi: "Cục cưng ơi,|nhớ uống nước nha!", en: "My sweetheart,|remember to sip!" }),
  Object.freeze({ vi: "Beo à Beo ơi,|đến giờ uống nước!", en: "Hey Beo, my love,|it's sip o'clock!" }),
  Object.freeze({ vi: "Nay bé thế nào?|Uống nước chưa nè?", en: "How's my Beo?|Had enough water?" }),
  Object.freeze({ vi: "Bé iu của anh,|đừng quên uống nước.", en: "My darling Beo,|don't forget water." }),
  Object.freeze({ vi: "Nhớ nha Beo,|uống nước đều nè!", en: "Remember, Beo,|sip throughout today!" }),
  Object.freeze({ vi: "Thương Beo quá,|uống nước xíu nha.", en: "Love you, Beo,|have a little sip." }),
  Object.freeze({ vi: "Beo ơi, Beo à,|một ngụm nữa nha?", en: "Beo, my sweetie,|one more sip?" }),
  Object.freeze({ vi: "Trời ơi bé ơi,|uống nước chưa ta?", en: "Oh, sweetheart,|did you sip yet?" }),
  Object.freeze({ vi: "Yêu Beo nhắm,|nhớ uống nước đó!", en: "Love you loads,|remember water!" }),
  Object.freeze({ vi: "Cục zàng nè,|uống nước để xinh ♡", en: "Hey darling,|have a sip for me ♡" }),
  Object.freeze({ vi: "Bé yêu hôm nay|uống đủ nước nha!", en: "Sweet Beo,|stay hydrated today!" })
]);

export function getDailySlogan(dayKey, language = 'vi') {
  const [year, month, day] = dayKey.split('-').map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const count = DAILY_SLOGANS.length;
  const cycle = Math.floor(daysSinceEpoch / count);
  const position = ((daysSinceEpoch % count) + count) % count;
  // A shuffled-looking 24-day cycle, with no adjacent repeats across cycles.
  const index = ((position * 7 + cycle * 11 + 5) % count + count) % count;
  return DAILY_SLOGANS[index][language === 'en' ? 'en' : 'vi'];
}
