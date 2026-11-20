/** Fifty local, non-push water reminders for the playful pink drop. */
export const WATER_NOTES = Object.freeze([
  "Nhớ uống nước ó nha Beo.",
  "Beo ơi, nhấp một ngụm nước nè.",
  "Uống chút nước rồi làm tiếp nha.",
  "Beo uống nước chưa đó?",
  "Để ly nước gần tay nha Beo.",
  "Dừng một xíu, uống nước cái đã.",
  "Tới giờ uống nước rồi, Beo ơi.",
  "Một ngụm nước nhỏ cũng được nha.",
  "Beo ơi, ly nước đang đợi kìa.",
  "Ngồi lâu rồi, uống nước đi nè.",
  "Nghỉ mắt chút rồi uống nước nha.",
  "Ra ngoài nhớ mang theo chai nước nhé.",
  "Bận mấy cũng nhớ nhấp nước nha.",
  "Thử uống vài ngụm nước xem nào.",
  "Nước lọc trước, việc tính sau nha.",
  "Beo ơi, nhớ uống nước đều đều nhé.",
  "Làm gì thì làm, nhớ có nước nha.",
  "Đổi tư thế rồi uống một ngụm nè.",
  "Cái ly nước còn đầy không Beo?",
  "Beo ơi, đừng quên chai nước đó.",
  "Một chút nước cho buổi chiều nha.",
  "Uống nước xong rồi tiếp tục nha.",
  "Đi lấy nước một chút đi Beo.",
  "Beo ơi, uống ngụm nước cho tỉnh.",
  "Nhấp nước từ từ thôi nha.",
  "Có nước bên cạnh chưa Beo?",
  "Chạm giọt nước rồi uống nước thật nha.",
  "Beo ơi, bận làm cũng nhớ uống nước.",
  "Tới lượt ly nước lên tiếng rồi nè.",
  "Uống nước trước khi quên nha Beo.",
  "Nghỉ tay một phút, uống nước nè.",
  "Beo ơi, thêm vài ngụm nước nhé.",
  "Chai nước đâu rồi, Beo ơi?",
  "Nhớ uống nước trước khi ra ngoài nha.",
  "Uống một xíu nước cho dễ chịu nè.",
  "Beo ơi, đừng để nước bị bỏ quên.",
  "Có đang khát không? Uống nước nha.",
  "Đang làm gì cũng nhấp nước được mà.",
  "Giọt nước này đang nhắc Beo đó.",
  "Beo ơi, một ngụm nước nữa nha.",
  "Rảnh tay rồi thì uống nước nè.",
  "Đi lấy thêm nước chưa, Beo?",
  "Lấy ít nước để sẵn cạnh mình nha.",
  "Nhấp chút nước rồi nghỉ một nhịp.",
  "Uống nước rồi mới lướt tiếp nha.",
  "Beo ơi, nhớ để nước cạnh bàn.",
  "Nút hồng không uống nước hộ đâu nha.",
  "Nhấn nút rồi thì uống nước luôn nè.",
  "Không cần vội, uống nước từ từ nhé.",
  "Beo nhớ chăm uống nước nha ♡"
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
  { eyebrow: "NHẮC BEO UỐNG NƯỚC MỖI NGÀY ♡", title: "Cục cưng ơi, em uống nước chưa?", body: "Nhớ uống nước đầy đủ nha em ♡" },
  { eyebrow: "MỘT CHÚT THƯƠNG GỬI BEO ♡", title: "Beo yêu, uống nước chút nha", body: "Anh nhắc xíu thôi, đừng quên uống nước đó." },
  { eyebrow: "BEO ƠI, ANH NHẮC NÈ ♡", title: "Bé ơi, nghỉ tay một chút", body: "Uống vài ngụm nước rồi mình làm tiếp nha." },
  { eyebrow: "UỐNG NƯỚC CÙNG ANH NHA ♡", title: "Cục zàng của anh ơi", body: "Sáng giờ em có nhớ uống nước không nè?" },
  { eyebrow: "NHẮC BÉ UỐNG NƯỚC ♡", title: "Em bé ơi, uống nước chưa?", body: "Đi lấy một ly nước rồi quay lại nha em." },
  { eyebrow: "MỘT LỜI NHẮC NHỎ ♡", title: "Beo đang bận lắm hả?", body: "Bận gì cũng nhớ uống chút nước nha." },
  { eyebrow: "ANH THƯƠNG BEO ♡", title: "Beo ơi, nghe anh nhắc nè", body: "Để chai nước gần tay cho dễ nhớ nhé." },
  { eyebrow: "BEO NHỚ UỐNG NƯỚC NHA ♡", title: "Cục cưng nghỉ xíu nhé", body: "Một ngụm nước thôi cũng được mà em." },
  { eyebrow: "NHẮC EM UỐNG NƯỚC ♡", title: "Hôm nay Beo thế nào?", body: "Uống nước đều đều cho anh yên tâm nha." },
  { eyebrow: "MỘT CHÚT QUAN TÂM ♡", title: "Bé thương ơi, anh đây", body: "Anh ghé nhắc bé uống nước một chút nè." },
  { eyebrow: "LỜI NHẮC DÀNH CHO BEO ♡", title: "Nào, mình uống nước nhé", body: "Em uống một ít rồi nghỉ ngơi tí nha." },
  { eyebrow: "UỐNG NƯỚC ĐỀU NHA BEO ♡", title: "Beo ơi, ly nước đâu rồi?", body: "Đừng mải làm mà quên uống nước em nhé." },
  { eyebrow: "GỬI EM MỘT CHÚT THƯƠNG ♡", title: "Anh nhắc Beo một xíu", body: "Nhớ chăm sóc bản thân nữa nha cục cưng." },
  { eyebrow: "BEO ƠI, ĐẾN GIỜ RỒI ♡", title: "Bé iu ơi, uống nước nha", body: "Có anh ở đây nhắc em uống nước nè." },
  { eyebrow: "THƯƠNG BEO MỖI NGÀY ♡", title: "Bé có khát nước không?", body: "Uống một chút trước khi thấy khát nha." },
  { eyebrow: "NHẮC BEO TỪ XA ♡", title: "Em ơi, cho anh nhắc tí", body: "Nhớ uống nước trước khi làm tiếp nè." },
  { eyebrow: "ANH NHẮC CỤC CƯNG ♡", title: "Một ly nước cho Beo nha", body: "Uống xong rồi kể anh nghe hôm nay thế nào." },
  { eyebrow: "DÀNH CHO BÉ YÊU ♡", title: "Beo à, mình nghỉ tay nhé", body: "Đứng dậy lấy nước uống một chút nha em." },
  { eyebrow: "MỖI NGÀY MỘT CHÚT ♡", title: "Cục cưng nhớ uống nước đó", body: "Thương em nên anh cứ muốn nhắc thôi ♡" },
  { eyebrow: "BEO ƠI, UỐNG NƯỚC THÔI ♡", title: "Bé ngoan, uống nước nhé", body: "Một ngụm rồi thêm một ngụm nữa nè." },
  { eyebrow: "MỘT NGỤM NƯỚC CHO BEO ♡", title: "Hôm nay Beo uống đủ chưa?", body: "Anh nhắc để em đừng quên ly nước bên cạnh." },
  { eyebrow: "ANH GỬI BEO LỜI NHẮC ♡", title: "Cục cưng, lại đây anh nhắc", body: "Nước đã để sẵn chưa em yêu?" },
  { eyebrow: "BEO ĐỪNG QUÊN UỐNG NƯỚC ♡", title: "Bé ơi, thêm chút nước nha", body: "Uống từ từ thôi, không cần vội đâu em." },
  { eyebrow: "MỖI NGÀY ĐỀU NHỚ BEO ♡", title: "Beo ơi, uống nước cùng anh", body: "Mình cùng uống một ly nước nhé ♡" }
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
