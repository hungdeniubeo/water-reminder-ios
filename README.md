# Water ♡ — Nhắc Beo mỗi ngày

Ứng dụng giữ một iPhone nhận thông báo và một trang Admin riêng. Màu hồng pastel được giữ nguyên, biểu tượng chuyển từ giọt nước sang **chuông có trái tim**.

**Tự động:** uống nước theo số phút tùy chỉnh; đi làm, ăn trưa và lịch khác theo giờ/ngày trong tuần. Mẫu đi làm **08:00 thứ 2–6** và ăn trưa **11:50 hằng ngày** được tạo sẵn nhưng **tắt mặc định**. Admin có thể sửa giờ, nội dung, ngày gửi, bật/tắt, thêm và xóa lịch. Vẫn có chức năng gửi ngay.

## Triển khai tính năng lịch mới

Trong repository trên máy Mac đang đăng nhập Cloudflare:

```bash
git pull --ff-only
cd backend
npm ci
npm run db:routines
npm run deploy
```

**Chạy migration trước khi deploy Worker.** Migration `0003-extra-reminders.sql` chỉ tạo bảng mới, không đổi VAPID, không reset D1, không xóa cài đặt uống nước hay phiên ghép iPhone. Không cần tạo Worker mới hoặc chạy lại migration 0002. App iPhone sẽ tiếp tục dùng cùng đường dẫn, `manifest.id`, `scope` và `start_url`.

Đăng nhập `admin.html`, tìm **Nhắc việc hằng ngày** và bật hai lịch mẫu hoặc bấm **+ Thêm** để tạo lịch riêng. Tất cả lịch cùng dùng múi giờ ở phần **Tùy chỉnh thêm**. Trang Admin tự báo nếu Worker cũ chưa hỗ trợ lịch mới.

**iPhone:** biểu tượng PWA đã ghim có thể được iOS lưu trong bộ nhớ đệm. Đừng xóa app chỉ để đổi icon khi chưa xác nhận app mở và nhận thông báo bình thường; việc xóa app có thể mất phiên kết nối.

## Kiểm thử

```bash
npm run check
npm test
```

Các bài test kiểm tra lịch theo múi giờ, thứ trong tuần, không gửi trùng, phân quyền Admin và tương thích chức năng cũ. Việc nhận thông báo thật và đổi icon màn hình chính vẫn cần xác minh trên iPhone.
