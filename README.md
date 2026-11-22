# Beo Daily ♡ — Lời nhắc mỗi ngày

Ứng dụng một người nhận: quản lý các lời nhắc từ trang Admin và nhận push notification trên một iPhone. **Lời nhắc hằng ngày là chức năng chính**; uống nước chỉ là một ví dụ trong lịch nhắc lặp.

## Admin

- **Lịch nhắc hằng ngày:** tạo/sửa/xóa, bật/tắt độc lập, chọn giờ (24h) và ngày trong tuần. Có mẫu nhập nhanh đi làm, ăn trưa, nghỉ ngơi, đi ngủ; các mẫu này chỉ điền form, không tự lưu.
- **Nhắc nhiều lần trong ngày:** lịch lặp theo phút hiện có được giữ lại trong một mục thu gọn. Các giá trị từ 5 đến 720 phút và nội dung tùy chỉnh vẫn hoạt động.
- **Sắp tới:** xem trước tối đa ba khung giờ theo múi giờ được lưu. Đây chỉ là lịch dự kiến, **không phải xác nhận iPhone đã nhận thông báo**.
- **Gửi ngay:** soạn nội dung, xem trước và gửi thông báo khi iPhone đã kết nối.
- **Thiết bị & lịch sử:** kiểm tra kết nối, tạo mã ghép mới, đối chiếu trạng thái tin gửi.

Admin ưu tiên thao tác trên điện thoại, có thanh điều hướng dưới màn hình, form tạo/sửa là bottom sheet và bộ chọn giờ thống nhất. Desktop dùng giao diện hai cột với form drawer.

## iPhone

Trang nhận chuyển sang lời chào và ghi chú hằng ngày, không chỉ nói về nước uống. Có thẻ **Lời nhắn gần nhất** khi có nội dung từ máy chủ. Nút trái tim chỉ tạo hiệu ứng và đổi ghi chú trên máy; không gửi push.

Đường dẫn, `manifest.id`, `scope`, `start_url`, khóa ghép thiết bị và session storage giữ nguyên. **Không xóa PWA khỏi iPhone chỉ để đổi tên/icon** vì iOS có thể làm mất phiên kết nối. Biểu tượng đã ghim có thể cập nhật chậm do cache iOS.

## Triển khai

Đây là nâng cấp frontend; không sửa `backend/worker.js`, cơ sở dữ liệu hay API. GitHub Pages sẽ lấy bản mới trên `main`. Hệ thống Cloudflare Worker và D1 hiện tại vẫn được dùng như cũ. Nếu lần triển khai lịch hàng ngày trước đó chưa chạy migration `0003-extra-reminders.sql`, cần hoàn tất theo hướng dẫn cũ mới dùng được lịch riêng.

## Kiểm thử

```bash
npm run check
npm test
```

Bộ test kiểm tra lịch theo múi giờ, trạng thái push, mã kết nối và các hàm giao diện. Việc push thực tế vẫn cần được xác nhận trên iPhone; UI chỉ hiển thị trạng thái có thật từ máy chủ.
