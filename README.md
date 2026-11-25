# Beo Daily ♡ — Lời nhắc mỗi ngày

Ứng dụng một người nhận: quản lý các lời nhắc từ trang Admin và nhận push notification trên một iPhone. **Lời nhắc hằng ngày là chức năng chính**; uống nước chỉ là một ví dụ trong lịch nhắc lặp.

## Admin

- **Lịch nhắc:** tạo/sửa/xóa, bật/tắt độc lập; giờ cố định, lặp theo phút, ngẫu nhiên theo ngày, hoặc ngày cụ thể (một lần, hằng tháng/hằng năm). Mỗi lịch có tiêu đề/nội dung cố định hoặc tối đa 10 biến thể. Có mẫu nhập nhanh đi làm, ăn trưa, nghỉ ngơi, đi ngủ; các mẫu này chỉ điền form, không tự lưu.
- **Nhắc nhiều lần trong ngày:** lịch lặp có sẵn hiện cùng danh sách, bật/tắt và sửa từ đó. Cài đặt gốc và nội dung tự đổi vẫn giữ nguyên; có thể tắt, không xóa lịch gốc. Mỗi lịch mới có cấu hình riêng.
- **Sắp tới:** xem trước tối đa ba khung giờ theo múi giờ được lưu. Đây chỉ là lịch dự kiến, **không phải xác nhận iPhone đã nhận thông báo**.
- **Gửi ngay:** soạn nội dung, xem trước và gửi thông báo khi iPhone đã kết nối.
- **Thiết bị & lịch sử:** kiểm tra kết nối, tạo mã ghép mới, đối chiếu trạng thái tin gửi.

Admin ưu tiên thao tác trên điện thoại, có thanh điều hướng dưới màn hình, form tạo/sửa là bottom sheet và bộ chọn giờ thống nhất. Desktop dùng giao diện hai cột với form drawer.

## iPhone

Trang nhận chuyển sang lời chào và ghi chú hằng ngày, không chỉ nói về nước uống. Có thẻ **Lời nhắn gần nhất** khi có nội dung từ máy chủ. Nút trái tim chỉ tạo hiệu ứng và đổi ghi chú trên máy; không gửi push.

Đường dẫn, `manifest.id`, `scope`, `start_url`, khóa ghép thiết bị và session storage giữ nguyên. **Không xóa PWA khỏi iPhone chỉ để đổi tên/icon** vì iOS có thể làm mất phiên kết nối. Biểu tượng đã ghim có thể cập nhật chậm do cache iOS.

## Triển khai

GitHub Pages lấy frontend từ `main`; Worker và D1 cần cập nhật riêng. Từ thư mục `backend`, chạy `npm ci`, `npm run db:reminders` rồi `npm run deploy`. Migration 0004 chỉ thêm bảng cấu hình; không thay đổi lịch cũ, khóa admin hoặc thiết bị. Nếu thiếu migration 0003, chạy `npm run db:routines` trước. Lịch cũ vẫn dùng được nếu chưa nâng cấp; form loại lịch mới chỉ mở khi API báo đã sẵn sàng.

Lịch ngẫu nhiên chọn giờ ổn định theo ID/ngày, cách nhau ít nhất 15 phút; thay đổi cấu hình có thể đổi các giờ còn lại. Lịch ngày 29/2 hoặc 31 bỏ qua tháng/năm không có ngày đó. Khi cron đến muộn chỉ bắt kịp lần gần nhất trong 14 phút; không gửi bù hàng loạt. Nội dung ngẫu nhiên xáo trộn theo ngày và xoay vòng để hạn chế lặp trong cùng ngày. Mọi lịch dùng múi giờ đã lưu.

## Kiểm thử

```bash
npm run check
npm test
```

Bộ test kiểm tra lịch theo múi giờ, trạng thái push, mã kết nối và các hàm giao diện. Việc push thực tế vẫn cần được xác nhận trên iPhone; UI chỉ hiển thị trạng thái có thật từ máy chủ.
