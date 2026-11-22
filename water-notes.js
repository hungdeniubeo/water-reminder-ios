/** Fifty short local notes. This button never sends a push notification. */
export const WATER_NOTES = Object.freeze([
  "Beo ơi, nhớ ăn đúng giờ nha.",
  "Hôm nay Beo có mệt không?",
  "Làm gì cũng nhớ nghỉ một chút nè.",
  "Đi làm nhớ mang theo đồ cần dùng nhé.",
  "Chúc Beo một ngày thật vui nha.",
  "Bé ơi, nghỉ mắt một xíu đi.",
  "Có việc gì quan trọng cần nhớ không Beo?",
  "Nhắc nhẹ: nhớ ăn trưa nha em.",
  "Đừng thức khuya quá nha Beo.",
  "Uống chút nước rồi làm tiếp nhé.",
  "Beo ơi, cho vai với cổ nghỉ tí.",
  "Ra đường nhớ đi cẩn thận nha.",
  "Hôm nay nhớ dành thời gian cho mình.",
  "Làm chậm lại một chút cũng được mà.",
  "Ăn sáng rồi mới đi làm nha.",
  "Có ai đang chờ Beo nghỉ tay không nè?",
  "Nhớ sạc điện thoại trước khi ra ngoài.",
  "Để ý thời gian đi ngủ nha em.",
  "Bé giỏi rồi, nghỉ tí cũng được.",
  "Mệt thì dừng lại một lát nha Beo.",
  "Đến giờ đứng dậy đi lại chút rồi.",
  "Cứ giải quyết từng việc thôi nha.",
  "Có anh ở đây nhắc Beo nè.",
  "Mang theo áo khoác nếu trời lạnh nha.",
  "Nhớ dành giờ ăn tối nữa nhé.",
  "Hôm nay còn việc gì chưa xong không?",
  "Một lời nhắc nhỏ cho ngày bớt bận.",
  "Làm xong việc nhớ tự thưởng chút nha.",
  "Beo ơi, nhớ nghỉ tay giữa giờ.",
  "Lịch trình dày thì cứ từ từ thôi.",
  "Đừng quên buổi hẹn của mình nha.",
  "Nhớ chuẩn bị đồ cho sáng mai nữa.",
  "Beo có muốn nhâm nhi chút nước không?",
  "Bật nhạc nhẹ rồi làm tiếp cũng được.",
  "Hôm nay Beo đã ăn trái cây chưa?",
  "Sắp tới giờ ngủ rồi đó nha.",
  "Nghỉ một phút, hít thở chút nè.",
  "Đi đâu nhớ xem lại đồ đạc nha.",
  "Beo ơi, kiểm tra lịch ngày mai nhé.",
  "Một cái ôm nhỏ gửi đến Beo ♡",
  "Bé nhớ chăm mình nữa nha.",
  "Chúc em buổi chiều thật nhẹ nhàng.",
  "Việc gấp thì làm, nhưng nhớ ăn nha.",
  "Beo ơi, tối rồi, thư giãn chút đi.",
  "Đừng quên nhắn anh khi về tới nhé.",
  "Hôm nay nhớ đi ngủ sớm hơn nha.",
  "Bận tới đâu cũng nhớ nghỉ giải lao.",
  "Một chút quan tâm từ xa dành cho em.",
  "Beo ơi, nhấp thêm chút nước nè.",
  "Anh thương Beo nhiều lắm đó ♡"
]);

/** Each of the 50 notes appears once per shuffled round, without an immediate repeat. */
export function createWaterNotePicker(random = Math.random) {
  let remaining = [];
  let last = null;
  return function nextNote() {
    if (!remaining.length) {
      remaining = WATER_NOTES.slice();
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      if (remaining[remaining.length - 1] === last) {
        [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
      }
    }
    last = remaining.pop();
    return last;
  };
}


/** Short rotating greetings for the ACTIVE iPhone receiver home screen. */
export const HOME_COPIES = Object.freeze([
  {"eyebrow": "NHẮC BEO MỖI NGÀY ♡", "title": "Hôm nay Beo thế nào rồi?", "body": "Anh ghé nhắc em vài việc nhỏ trong ngày nha."},
  {"eyebrow": "MỘT CHÚT THƯƠNG ♡", "title": "Bé ơi, bắt đầu ngày mới nha", "body": "Hôm nay cứ thong thả làm từng việc thôi em."},
  {"eyebrow": "GỬI RIÊNG CHO BEO ♡", "title": "Beo yêu, nhớ ăn đúng giờ đó", "body": "Đừng mải làm mà bỏ bữa nha cục cưng."},
  {"eyebrow": "ANH NHẮC NHẸ THÔI ♡", "title": "Nghỉ tay một chút đi em", "body": "Dành vài phút cho mình rồi làm tiếp nha Beo."},
  {"eyebrow": "HÔM NAY CÓ ANH NHẮC ♡", "title": "Đi làm vui nha cục cưng", "body": "Nhớ mang đủ đồ và đi đường cẩn thận nhé."},
  {"eyebrow": "LỜI NHẮC NHỎ ♡", "title": "Bé nhớ chăm mình nữa nha", "body": "Ăn uống, nghỉ ngơi đầy đủ cho anh yên tâm."},
  {"eyebrow": "MỖI NGÀY MỘT CHÚT ♡", "title": "Một ngày mới của Beo bắt đầu", "body": "Chúc em có nhiều điều vui và ít việc gấp nha."},
  {"eyebrow": "CÓ ANH Ở ĐÂY ♡", "title": "Beo ơi, mình cứ từ từ thôi", "body": "Việc nào tới trước mình làm trước, đừng vội."},
  {"eyebrow": "DÀNH CHO BÉ YÊU ♡", "title": "Sắp tới giờ nghỉ rồi đó", "body": "Em tranh thủ thả lỏng một chút nha Beo."},
  {"eyebrow": "NHẮC BEO TỪ XA ♡", "title": "Bé thương, nhớ lịch của mình nha", "body": "Có gì quan trọng thì anh sẽ nhắc em đúng giờ."},
  {"eyebrow": "THƯƠNG BEO MỖI NGÀY ♡", "title": "Hôm nay Beo có bận lắm không?", "body": "Bận thì bận, nhớ dành thời gian ăn nha em."},
  {"eyebrow": "MỘT CHÚT QUAN TÂM ♡", "title": "Để anh nhắc Beo một xíu nhé", "body": "Chuyện nhỏ thôi, nhưng anh muốn em nhớ đó."},
  {"eyebrow": "BEO ƠI, NGHE ANH NÈ ♡", "title": "Đến giờ chăm sóc bản thân rồi", "body": "Đứng dậy, uống nước và nghỉ mắt chút nha."},
  {"eyebrow": "GỬI EM MỘT LỜI NHẮC ♡", "title": "Một ngày nhẹ nhàng nha bé", "body": "Anh mong hôm nay mọi việc đều suôn sẻ."},
  {"eyebrow": "BEO CƯNG CỦA ANH ♡", "title": "Hôm nay mình có gì cần nhớ?", "body": "Anh giúp em nhớ những việc quan trọng nhé."},
  {"eyebrow": "ANH NHỚ BEO ♡", "title": "Bé ơi, đừng thức khuya nha", "body": "Làm xong thì nghỉ ngơi sớm một chút em nhé."},
  {"eyebrow": "NHẮC EM NHẸ NHÀNG ♡", "title": "Đến bữa thì phải ăn đó nha", "body": "Em làm việc chăm rồi, giờ nhớ ăn chút đi."},
  {"eyebrow": "MỘT TÍ XÍU DỄ THƯƠNG ♡", "title": "Cục cưng, thả lỏng chút nha", "body": "Không cần làm hết mọi việc cùng lúc đâu em."},
  {"eyebrow": "MỖI NGÀY ĐỀU CÓ ANH ♡", "title": "Beo yêu, anh gửi một lời nhắc", "body": "Nhớ nghỉ ngơi và giữ sức cho ngày mai nha."},
  {"eyebrow": "CHỈ DÀNH CHO BEO ♡", "title": "Bé ơi, anh có điều muốn nhắc", "body": "Ra ngoài nhớ chuẩn bị đủ đồ đạc đó nha."},
  {"eyebrow": "TỪ ANH GỬI EM ♡", "title": "Một chút bình yên cho hôm nay", "body": "Nếu mệt thì cứ nghỉ, đừng cố quá nha."},
  {"eyebrow": "NHẮC MỘT CHÚT THÔI ♡", "title": "Beo nhớ xem lại lịch ngày mai", "body": "Chuẩn bị trước một xíu để mai đỡ vội nha."},
  {"eyebrow": "ANH THƯƠNG BÉ ♡", "title": "Hết ngày rồi, em nghỉ thôi", "body": "Tắt bớt việc và ngủ ngon nha cục cưng."},
  {"eyebrow": "NGÀY NÀO CŨNG NHỚ BEO ♡", "title": "Beo ơi, anh ở đây nè", "body": "Việc gì cần nhớ, mình ghi lịch để anh nhắc nha."}
].map(copy => Object.freeze(copy)));

export const HOME_COPY_KEY = 'water-beo-home-copy-last-v1';

/** A new visit gets a new message. Re-renders keep the chosen text stable. */
export function pickHomeCopy({ storage, random = Math.random } = {}) {
  const count = HOME_COPIES.length;
  const sample = Number(random());
  const n = Number.isFinite(sample) ? Math.max(0, Math.min(.999999, sample)) : 0;
  let previous = -1;
  try {
    const raw = storage?.getItem(HOME_COPY_KEY);
    const value = raw === null || raw === undefined ? -1 : Number(raw);
    if (Number.isInteger(value) && value >= 0 && value < count) previous = value;
  } catch { /* Private browsing can block storage; rotating still works. */ }
  const index = previous < 0 ? Math.floor(n * count)
    : (previous + 1 + Math.floor(n * (count - 1))) % count;
  try { storage?.setItem(HOME_COPY_KEY, String(index)); } catch {}
  return HOME_COPIES[index];
}
