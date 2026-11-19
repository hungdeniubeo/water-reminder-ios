# Bật thông báo thật trên iPhone (Water Couple V2)

Phần giao diện và mã nguồn Web Push đã có sẵn. **GitHub Pages không tự gửi thông báo**; cần thiết lập Cloudflare Worker một lần. Không có khoản phí cố định nếu sử dụng trong giới hạn gói Free (chỉ 2 điện thoại), nhưng gói Free có hạn mức và Cloudflare có thể thay đổi chính sách.

## Những thứ đã có sẵn

- iPhone Home Screen PWA, service worker nhận `push` / nhấn vào thông báo để mở app
- Giao diện ghép 2 điện thoại bằng mã chỉ có hiệu lực 10 phút
- Thêm tên riêng, lời nhắn tới người yêu; hai máy hiển thị tổng ml hôm nay khi đã kết nối
- Người dùng chủ động cấp/tắt quyền thông báo; nút gửi thử
- Worker + D1 gửi Web Push bằng VAPID, Cron chạy mỗi phút
- Mỗi máy có lịch và ngôn ngữ nhắc riêng; dữ liệu từng lần uống vẫn ở trên iPhone

## Thiết lập một lần

1. Tạo tài khoản **Cloudflare Free** tại https://dash.cloudflare.com/.
2. Trên Mac, cài **Node.js 22+**. Clone repo hoặc tải ZIP source của `water-reminder-ios` về máy, mở Terminal trong thư mục `backend`.
3. Đăng nhập Cloudflare và tạo database:

```bash
npm install
npx wrangler login
npx wrangler d1 create water-couple
```

4. Lệnh trả về `database_id`. Mở `backend/wrangler.jsonc`, thay `REPLACE_WITH_D1_DATABASE_ID` bằng ID đó.
5. Tạo bảng (chỉ lần đầu):

```bash
npx wrangler d1 execute water-couple --remote --file=./schema.sql
```

6. Tạo khóa VAPID:

```bash
node scripts/generate-vapid.mjs
```

   - Dán giá trị **VAPID_PUBLIC_KEY** vào `VAPID_PUBLIC_KEY` trong `wrangler.jsonc` (public key được phép có trong GitHub).
   - **KHÔNG** dán `VAPID_PRIVATE_KEY` vào GitHub, ChatGPT hoặc bất cứ file commit nào.
   - Đặt private key trực tiếp vào Cloudflare bằng lệnh:

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

   Dán giá trị private key khi CLI yêu cầu.

7. Đặt một **mã thiết lập riêng** (dài, khó đoán, chỉ hai người biết) bằng lệnh:

```bash
npx wrangler secret put OWNER_SETUP_CODE
```

   Dán chuỗi ít nhất 16 ký tự khi CLI yêu cầu. Mã này dùng đúng **một lần** để tạo phòng đầu tiên. Không đưa mã vào GitHub hoặc nhắn lên chat.

8. Triển khai Worker:

```bash
npx wrangler deploy
```

   Copy URL từ đầu ra, dạng `https://water-couple-push.<account>.workers.dev`.

9. Trong `push-config.js` ở root repo, thay chuỗi rỗng bằng URL đó:

```js
export const PUSH_API_URL = 'https://water-couple-push.YOUR_ACCOUNT.workers.dev';
```

   Commit file. Vì đây chỉ là URL công khai, có thể gửi URL cho ChatGPT để cập nhật file qua GitHub Repo Editor. **Không gửi private key hay mã thiết lập**.

10. Mở lại PWA trên iPhone khi có mạng. Tab **Hai đứa** sẽ chuyển từ thông báo "Chưa kết nối" sang màn hình ghép đôi.

## Cài đặt cho hai người

1. Cả hai mở Water từ biểu tượng trên **Home Screen** (Safari → Chia sẻ → Thêm vào Màn hình chính nếu chưa cài).
2. Máy thứ nhất: tab **Hai đứa** → nhập tên → nhập mã thiết lập riêng → **Tạo không gian của hai đứa**. App sẽ hiển thị mã ghép 8 ký tự (10 phút).
3. Máy thứ hai: tab **Hai đứa** → nhập tên → nhập mã trên → **Kết nối**.
4. Mỗi máy vào **Cài đặt** để bật lịch nhắc (ví dụ 09:00–21:00, mỗi 2 giờ), rồi **Lưu lịch nhắc**.
5. Mỗi máy tự nhấn **Bật thông báo**, chọn **Cho phép / Allow**, sau đó nhấn **Gửi thử một lời nhắc**. Nếu iPhone không hiện thông báo, kiểm tra Settings → Notifications → Water và chế độ Focus.
6. Có thể nhập lời nhắn riêng trên máy của mình. Lúc gửi lời nhắc cho người kia, Worker ưu tiên lời nhắn này.

**Lưu ý:** Tên riêng, lịch nhắc và tổng số ml hôm nay có thể đồng bộ qua Cloudflare khi ghép đôi. Lịch sử từng lần uống **không đồng bộ**. Nếu xóa app/website data, cần ghép lại để lấy mã đăng nhập mới; thiết bị cũ phải ngắt kết nối trước khi có thể thêm máy khác.

## Giới hạn & bảo mật

- iOS **16.4+** cần Home Screen web app, quyền thông báo, mạng và push subscription. Web Push có thể bị chặn bởi Focus hoặc đến muộn; không cam kết chính xác đến từng giây.
- Worker chỉ chấp nhận request từ origin `https://hungdeniubeo.github.io`, xác thực mỗi thiết bị bằng mã bí mật cục bộ, giới hạn tối đa **2 thiết bị**.
- Mã ghép một lần hết hạn sau 10 phút. Có thể bấm **Làm mới trạng thái** để tạo mã mới nếu chưa đủ 2 máy.
- Lịch sử nước uống chi tiết nằm ở localStorage iPhone. Cloudflare D1 lưu tên, lời nhắn, tổng ml hôm nay, mục tiêu, lịch nhắc, timezone, subscription (endpoint/keys công khai để gửi push), thời gian gửi lần cuối và token hash.
- VAPID private key và mã thiết lập phải nằm trong **Worker Secrets**, không commit. Đừng gửi cho người khác.
- Cần giới hạn tài nguyên khi công khai dịch vụ và cân nhắc thêm Cloudflare Turnstile/rate limiting nếu mở cho nhiều người.
- Cloudflare Free Workers có hạn mức request/CPU và D1 có hạn mức hàng ngày. Hệ thống hướng tới 2 thiết bị, không phải dịch vụ công khai lớn.

## Nếu gặp lỗi

- Tab Hai đứa báo chưa kết nối: kiểm tra `push-config.js`, deploy Worker và secret.
- Cấp quyền không được: mở **từ icon Home Screen**, iOS >= 16.4, kiểm tra Settings → Notifications.
- Test push lỗi 401: dữ liệu ghép đôi thiết bị đã hết hạn hoặc bị ngắt; ghép lại.
- Test push lỗi 429: mỗi máy chỉ được thử một lần trong **2 phút**.
- Không thấy thông báo: kiểm tra Cron trong Cloudflare → Worker → Settings → Triggers, xem logs, thời gian / timezone và đảm bảo đã bật lịch trong Settings của app.

Tài liệu chính thức: [Apple WebKit](https://webkit.org/blog/13878/) · [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1](https://developers.cloudflare.com/d1/platform/limits/).