# Admin và app iPhone của Beo

## Hai trang, hai vai trò

| Trang | Ai dùng | Việc chính |
| --- | --- | --- |
| App iPhone `/` | Beo | Nhận thông báo, xem lời nhắn, kết nối một lần |
| Trang `/admin.html` | Chủ app | Chỉnh tên/lời nhắn/lịch, tạo mã kết nối, gửi thông báo |

Trang quản trị dùng khoá bí mật và phiên đăng nhập riêng. Mã kết nối của Beo không có quyền admin. Không đưa khoá admin vào JavaScript, URL, GitHub hoặc chat.

## Cập nhật hệ thống đang có

Chạy trong bản sao repository đã cấu hình Cloudflare. Cần quyền truy cập tài khoản Cloudflare chứa Worker `water-beo-push` và D1 `water-couple`.

```bash
cd ~/water-couple-setup
git pull --ff-only
cd backend
npm ci
npm run db:upgrade
npm run deploy
```

`db:upgrade` thêm bảng mới, giữ nguyên mã thiết bị và đăng ký thông báo hiện có. Có thể chạy lại migration. Không cần tạo lại database hoặc đổi VAPID. Với cài đặt hoàn toàn mới, dùng `npm run db:migrate` thay cho `db:upgrade` sau khi cấu hình binding D1.

**Thứ tự phát hành:** migration → Worker mới → giao diện GitHub Pages mới. Trước khi giao diện mới lên chính thức, giữ thay đổi trên nhánh riêng và chạy các lệnh tương ứng trên nhánh đó. Sau khi Worker sẵn sàng, đưa bản giao diện mới lên `main`. Trang mới sẽ báo chờ cập nhật nếu máy chủ vẫn là phiên bản cũ.

Kiểm tra API công khai:

```bash
curl -A 'WaterReminderHealth/2.0' https://water-beo-push.hungdeniubeo-water.workers.dev/api/config
```

Kết quả cần có `apiVersion: 2`, `mode: "admin-receiver"`, `ready: true`. `migration-required` nghĩa là còn thiếu bước nâng cấp D1. `configuration-required` nghĩa là cần kiểm tra binding/biến/bí mật máy chủ.

### Khoá quản trị

Khoá admin mặc định là `OWNER_SETUP_CODE` đang có trên Worker. Chủ app dùng khoá này để đăng nhập trang admin; **không đưa khoá này cho Beo**. Nếu muốn đặt một khoá quản trị riêng, có thể đặt bí mật `ADMIN_SECRET` (ít nhất 16 ký tự):

```bash
npx wrangler secret put ADMIN_SECRET
```

Nhập trực tiếp tại lời nhắc an toàn của Wrangler. Không ghi giá trị vào file được commit. Khi đổi khoá, các phiên admin cũ sẽ hết hiệu lực. Giữ nguyên `VAPID_PRIVATE_KEY` và `VAPID_PUBLIC_KEY` hiện tại để các đăng ký thông báo cũ tiếp tục hoạt động.

## Kết nối đúng iPhone

1. Chủ app mở `/admin.html` và đăng nhập.
2. Ở mục iPhone, bấm **Tạo mã kết nối**. Mã gồm tám chữ số, dùng một lần trong 10 phút.
3. Trên iPhone của Beo (iOS 16.4 trở lên), mở app bằng Safari, chọn **Chia sẻ → Thêm vào MH chính**.
4. Mở app bằng biểu tượng trên màn hình chính. Nhập mã kết nối.
5. Beo chạm **Bật thông báo** rồi chọn **Cho phép** trong hộp thoại iPhone.
6. Trang admin phải báo iPhone đã bật nhận thông báo.

Nếu iPhone đã dùng app cũ và còn mã thiết bị hợp lệ, app giữ kết nối đó. Không cần ghép lại chỉ vì cập nhật giao diện. Nếu trước đây đã ghép nhầm điện thoại của chủ app, chọn **Kết nối iPhone khác** và nhập mã mới trên máy Beo. Điện thoại cũ chỉ bị ngắt khi lần ghép mới thành công.

## Gửi lời nhắn

Trong **Gửi ngay cho em**, nhập tiêu đề và nội dung (tối đa 70 và 150 ký tự), xem trước rồi bấm **Gửi thông báo**. Đây là thao tác gửi thật, không phải chỉ xem thử giao diện.

Trạng thái trong mục Gần đây:

| Trạng thái | Ý nghĩa |
| --- | --- |
| Đang gửi | Chưa có kết quả từ dịch vụ thông báo |
| Đã chuyển đi | Dịch vụ thông báo chấp nhận lời nhắn |
| iPhone đã nhận | App iPhone đã xử lý và yêu cầu hiển thị thông báo, rồi gửi biên nhận |
| Đã mở | Người dùng đã chạm vào thông báo |
| Sẽ thử lại | Lỗi tạm thời, máy chủ còn lượt thử trong 15 phút |
| Gửi chưa được | Thất bại, hết lượt hoặc kết nối đã hết hạn |

Biên nhận có thể mất do mạng. “Đã chuyển đi” không đủ để kết luận Beo đã thấy thông báo. “iPhone đã nhận” cũng không thay thế xác nhận trực tiếp rằng banner/âm thanh xuất hiện: iOS có thể áp dụng chế độ Tập trung và cài đặt thông báo.

## Lịch và giao diện

Admin chọn bật/tắt nhắc tự động, giờ bắt đầu/kết thúc trong cùng ngày, khoảng cách 60/90/120/180 phút và múi giờ. Máy chủ chạy lịch kể cả khi app đóng. Lịch có thể gửi ở giờ kết thúc nếu giờ đó khớp khoảng cách; một lần chạy trễ có thể gửi bù trong 14 phút.

Lời nhắc tự động dùng đúng tiêu đề/nội dung đã lưu trong admin. Tại **Chỉnh tên và trang chủ của Beo**, có thể đổi tên người nhận, tên hiển thị trong app và lời nhắn trang chủ. App lấy thay đổi khi được mở và có mạng. Tên biểu tượng app đã cài và kiểu banner vẫn do iPhone quản lý.

## Nếu chưa thấy thông báo

- Nếu iPhone đã kết nối nhưng gửi báo **“Chưa xác nhận được kết quả gửi từ dịch vụ thông báo”**, cập nhật Worker lên bản sửa `redirect: 'manual'`. Bản cũ dùng `redirect: 'error'`, tùy chọn [Cloudflare Workers không hỗ trợ](https://developers.cloudflare.com/workers/runtime-apis/request/), nên dừng trước khi gửi. Chạy `git pull --ff-only` trên nhánh đã nhận bản sửa, rồi `cd backend` và `npm run deploy`. Đợt sửa này không đổi database, VAPID hoặc kết nối iPhone.
- Kiểm tra admin đã kết nối **đúng iPhone của Beo**, không phải điện thoại của chủ app.
- Mở app từ màn hình chính, xác nhận **Đã bật thông báo**. App đối chiếu đăng ký thật trên điện thoại với máy chủ mỗi lần mở.
- Nếu quyền bị tắt, vào **Cài đặt iPhone → Thông báo → Water** rồi cho phép thông báo và màn hình khoá.
- Kiểm tra Tập trung, Tóm tắt theo lịch, mạng và cài đặt âm thanh của iPhone.
- Xem lỗi cụ thể trong mục Gần đây. Kết nối hết hạn cần mở app để bật lại; lỗi xác thực dịch vụ cần kiểm tra cặp VAPID.
- Nếu admin báo chờ cập nhật, kiểm tra đã deploy Worker và migration, không chỉ cập nhật HTML trên GitHub.

## Kiểm thử

Chạy `npm ci --prefix backend` trước khi kiểm thử. `npm test` chạy logic và tích hợp bằng SQLite thật, cùng kiểm tra phần gửi trong runtime `workerd` bằng khóa thử và endpoint giả lập. Kiểm tra này dùng thư viện mã hóa thật và không gửi thông báo ra ngoài. `npm run check` kiểm tra cú pháp các entry point đang dùng. `npx wrangler deploy --dry-run` trong thư mục `backend` kiểm tra đóng gói Worker mà không đưa lên production.

Kiểm tra cuối trên thiết bị thật: sau khi Beo cho phép thông báo, chủ app chủ động gửi một lời nhắn, khóa màn hình iPhone, quan sát thông báo và chạm để mở đúng nội dung. Không đánh dấu đã xác minh nhận thật chỉ từ kết quả kiểm thử giả lập.
