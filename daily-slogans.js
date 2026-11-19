/** Gentle daily love notes for Beo. One deterministic bilingual headline per local day. */
export const DAILY_SLOGANS = Object.freeze([
  Object.freeze({ vi: "Beo ơi, hôm nay|em uống nước chưa?", en: "Beo, my love,|had water today?" }),
  Object.freeze({ vi: "Sáng giờ Beo|có uống nước chưa?", en: "Sweet Beo,|had any water yet?" }),
  Object.freeze({ vi: "Cục zàng ơi,|uống chút nước nha ♡", en: "My darling,|have a little sip ♡" }),
  Object.freeze({ vi: "Beo yêu của anh,|uống nước chút nha?", en: "My sweetest Beo,|have a sip with me?" }),
  Object.freeze({ vi: "Beo ơi Beo à,|nhớ uống nước nha ♡", en: "Beo, my love,|a little sip today ♡" }),
  Object.freeze({ vi: "Bé iu ơi,|uống nước chưa nè?", en: "Sweetie,|had a sip yet?" }),
  Object.freeze({ vi: "Beo xinh ơi,|mình uống nước nha ♡", en: "Lovely Beo,|let's have some water ♡" }),
  Object.freeze({ vi: "Bé của anh ơi,|uống nước với anh nha", en: "My sweet Beo,|have a sip with me ♡" }),
  Object.freeze({ vi: "Beo ơi,|có nhớ uống nước hông?", en: "Beo, sweetheart,|remember your water?" }),
  Object.freeze({ vi: "Cục cưng ơi,|mình uống chút nước nha", en: "My sweetie,|a little water together?" }),
  Object.freeze({ vi: "Hôm nay Beo|uống nước đều hông?", en: "Beo darling,|sipping water today?" }),
  Object.freeze({ vi: "Em bé Beo ơi,|uống nước chút nhé ♡", en: "My baby Beo,|a little sip for you ♡" }),
  Object.freeze({ vi: "Thương Beo quá,|nhớ uống nước nha em", en: "Love you, Beo,|remember a little sip ♡" }),
  Object.freeze({ vi: "Beo yêu à,|nhấp một ngụm nha ♡", en: "My dear Beo,|one gentle sip? ♡" }),
  Object.freeze({ vi: "Sáng nay Beo|có nhớ uống nước hông?", en: "Since morning, Beo,|had some water?" }),
  Object.freeze({ vi: "Bé thương ơi,|anh nhắc uống nước nè", en: "My sweet girl,|a little water reminder" }),
  Object.freeze({ vi: "Beo à,|uống nước chút nha em ♡", en: "Beo, sweetie,|have a little sip ♡" }),
  Object.freeze({ vi: "Cục zàng à,|em uống nước chưa nè?", en: "Darling Beo,|had some water yet?" }),
  Object.freeze({ vi: "Beo ơi,|để anh nhắc uống nước ♡", en: "Beo, my dear,|a gentle water reminder" }),
  Object.freeze({ vi: "Beo ơi, hôm nay|em uống nước chưa? ♡", en: "Beo, darling,|did you sip today? ♡" }),
  Object.freeze({ vi: "Beo của anh,|mình uống nước nhé ♡", en: "My darling Beo,|shall we have a sip?" }),
  Object.freeze({ vi: "Bé iu ơi,|uống nước rồi hả em?", en: "Sweet love,|have you had a sip?" }),
  Object.freeze({ vi: "Beo nè,|anh nhắc uống nước nha ♡", en: "Little Beo,|a sip for you, love ♡" }),
  Object.freeze({ vi: "Beo ơi,|uống nước chút xíu nha", en: "Beo, sweetie,|a little sip today? ♡" }),
  Object.freeze({ vi: "Bé cưng ơi,|nghỉ tay uống nước nhé", en: "My sweetheart,|take a sip and rest ♡" }),
  Object.freeze({ vi: "Beo iu ơi,|nay em có khát không?", en: "My lovely Beo,|feeling thirsty today?" }),
  Object.freeze({ vi: "Thương em nè,|nhớ uống nước nha Beo", en: "Love you, Beo,|remember to sip ♡" }),
  Object.freeze({ vi: "Hôm nay của Beo|có ly nước nào chưa?", en: "Dear sweet Beo,|had a little water?" }),
  Object.freeze({ vi: "Beo ơi,|uống nước cùng anh nha ♡", en: "Beo, my love,|sip together with me ♡" }),
  Object.freeze({ vi: "Cục zàng bé nhỏ,|nhớ uống nước nha ♡", en: "My little darling,|remember your water ♡" })
]);

export function getDailySlogan(dayKey, language = 'vi') {
  const [year, month, day] = dayKey.split('-').map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const count = DAILY_SLOGANS.length;
  const cycle = Math.floor(daysSinceEpoch / count);
  const position = ((daysSinceEpoch % count) + count) % count;
  const index = ((position * 7 + cycle * 11 + 5) % count + count) % count;
  return DAILY_SLOGANS[index][language === 'en' ? 'en' : 'vi'];
}
