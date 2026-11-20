/** Gentle daily love notes for Beo. One deterministic bilingual headline per local day. */
export const DAILY_SLOGANS = Object.freeze([
  Object.freeze({ vi: "Nhắc Beo uống nước|mỗi ngày ♡", en: "Water reminder|for my Beo ♡" }),
  Object.freeze({ vi: "Cục cưng ơi,|em uống nước chưa?", en: "Sweetheart,|had your water yet?" }),
  Object.freeze({ vi: "Beo của anh ơi,|uống nước đầy đủ nha", en: "My lovely Beo,|remember to hydrate" }),
  Object.freeze({ vi: "Em bé dễ thương,|uống nước chút nha ♡", en: "A little water break|for my darling ♡" }),
  Object.freeze({ vi: "Hôm nay của Beo|có đủ nước chưa?", en: "Beo, have you|had enough water?" }),
  Object.freeze({ vi: "Một ngụm nước nhỏ,|một chút yêu thương", en: "One little sip,|one little love note" }),
  Object.freeze({ vi: "Bé ơi, nghỉ tay|uống nước xíu nha", en: "Take a small break,|have some water ♡" }),
  Object.freeze({ vi: "Anh nhắc Beo nè,|đừng quên nước nhé ♡", en: "Just checking in,|did you drink water?" }),
  Object.freeze({ vi: "Cục zàng ơi,|đến giờ uống nước rồi", en: "Darling Beo,|it's water time ♡" }),
  Object.freeze({ vi: "Beo ơi,|cho mình nghỉ xíu nha", en: "Beo, let's take|a tiny break together" }),
  Object.freeze({ vi: "Uống nước đi nè,|anh thương Beo ♡", en: "Have some water,|love you, Beo ♡" }),
  Object.freeze({ vi: "Có ai đó đang|nhắc bé uống nước ♡", en: "Someone is here|to remind you ♡" }),
  Object.freeze({ vi: "Bé yêu của anh,|uống nước chưa nè?", en: "My sweet Beo,|have you had a sip?" }),
  Object.freeze({ vi: "Beo ngoan ơi,|uống thêm chút nhé", en: "One more sip|for my sweetheart" }),
  Object.freeze({ vi: "Một ly nước cho|cô bé anh thương ♡", en: "A glass of water|for my favorite girl" }),
  Object.freeze({ vi: "Chăm Beo từ|những điều nhỏ nhất", en: "Caring for Beo,|one sip at a time" }),
  Object.freeze({ vi: "Béo ơi,|uống nước cùng anh nha", en: "Beo, darling,|let's drink water" }),
  Object.freeze({ vi: "Em đã uống nước|từ sáng tới giờ chưa?", en: "Had water yet|since this morning?" }),
  Object.freeze({ vi: "Làm gì thì làm,|nhớ uống nước nha ♡", en: "Busy day or not,|remember your water" }),
  Object.freeze({ vi: "Anh gửi Beo|một lời nhắc xinh", en: "A sweet little note|just for Beo ♡" }),
  Object.freeze({ vi: "Cục cưng à,|uống một ngụm nhé", en: "Hey darling,|take a little sip" }),
  Object.freeze({ vi: "Nắng hay mưa,|Beo vẫn nhớ uống nước", en: "Rain or shine,|remember your water" }),
  Object.freeze({ vi: "Hôm nay bận lắm hả?|Uống nước chút nha", en: "A busy day, Beo?|Take a water break" }),
  Object.freeze({ vi: "Một chút nước thôi,|Beo yêu của anh ♡", en: "Just a little sip,|with lots of love ♡" }),
  Object.freeze({ vi: "Bé thương ơi,|mình uống nước nha", en: "My sweetheart,|let's have some water" }),
  Object.freeze({ vi: "Để anh nhắc nhé,|em nhớ uống nước ♡", en: "A little reminder,|drink water, love ♡" }),
  Object.freeze({ vi: "Beo ơi,|ly nước đang đợi em", en: "Beo, your water|is waiting for you" }),
  Object.freeze({ vi: "Ngày mới xinh rồi,|Beo uống nước nha", en: "A lovely new day,|a little water ♡" }),
  Object.freeze({ vi: "Em ơi, nghỉ một tí|rồi uống nước nhé", en: "Rest for a moment,|and drink some water" }),
  Object.freeze({ vi: "Thêm một ngụm nước,|thêm một chút thương", en: "One more sip,|one more bit of love" })
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
