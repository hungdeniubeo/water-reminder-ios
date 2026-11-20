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
