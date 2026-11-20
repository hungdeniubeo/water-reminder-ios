# Quyền riêng tư — Water ♡

Water là app riêng cho một người nhận (Beo) và một người quản trị. App dùng để nhận lời nhắc/lời nhắn. Phiên bản hiện tại không yêu cầu nhập lượng nước, cân nặng hay nhật ký sức khoẻ.

## Trên iPhone

App lưu mã xác thực thiết bị, một bản tên/lời nhắn gần nhất để xem ngoại tuyến và các tệp giao diện. Quyền thông báo do iPhone quản lý. Dữ liệu theo dõi nước từ phiên bản cũ, nếu còn trên thiết bị, không được đọc hoặc tự xoá bởi giao diện mới.

## Trên máy chủ

Cloudflare lưu cấu hình app, tên người nhận, nội dung/lịch nhắc, đăng ký Web Push của một thiết bị và lịch sử gửi/nhận/mở thông báo. Lịch sử thông báo được dọn sau 30 ngày bởi tác vụ định kỳ. Trạng thái “đã mở” ghi nhận lần chạm thông báo, không suy ra việc đọc hoặc uống nước.

Mã admin được đặt trong bí mật máy chủ. Phiên admin lưu dạng băm trên máy chủ, hết hạn sau 12 giờ; trình duyệt admin giữ mã phiên trong sessionStorage. Mã ghép thiết bị chỉ dùng một lần và hết hạn sau 10 phút. Hệ thống giới hạn số lần thử đăng nhập/kết nối bằng dữ liệu tạm thời, gồm băm địa chỉ IP. Mã admin không được gửi cho Beo hoặc nhúng vào mã nguồn công khai.

Thông báo được mã hoá theo Web Push và đi qua dịch vụ thông báo của trình duyệt/hệ điều hành (Apple trên iPhone). Biên nhận gửi về máy chủ dùng mã kiểm chứng riêng cho từng lời nhắn. Kết quả gửi tới dịch vụ không đồng nghĩa người nhận đã đọc.

## Quyền kiểm soát

Beo có thể tắt quyền thông báo trong Cài đặt iPhone. Admin quản lý nội dung, tắt lịch nhắc và ghép lại đúng một iPhone. Khi điện thoại mới ghép thành công bằng mã thay thế, thông tin xác thực của điện thoại cũ không còn quyền truy cập.

Không dùng quảng cáo, mã theo dõi hay phân tích người dùng của bên thứ ba.
