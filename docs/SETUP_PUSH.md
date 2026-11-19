# Bật thông báo cho Beo — một iPhone duy nhất

Ứng dụng giữ nguyên nhật ký uống nước trên iPhone 12 Pro Max. Cloudflare chỉ giữ lịch nhắc và subscription gửi thông báo. **Không cần ghép đôi hay tạo database thứ hai.**

## Trạng thái hiện tại

- Cloudflare account: đã đăng nhập thành công.
- Database D1 `water-couple`: đã tạo ở APAC, ID `18bd620f-30f8-4a8d-b4cd-8b150c3f7e53`.
- Schema: đã import thành công (5 truy vấn). Không chạy lại chỉ vì đổi từ couple sang một người.
- Worker `water-beo-push`: chưa triển khai.
- VAPID keys và mã kích hoạt riêng: chưa tạo.

## 1. Đồng bộ mã nguồn trên Mac mini

```bash
cd ~/water-couple-setup
git pull --ff-only
cd backend
```

Cấu hình `wrangler.jsonc` đã dùng binding `DB` và database ID có sẵn. Không cần chạy lại `wrangler d1 create` hoặc `d1 execute`.

## 2. Tạo khóa Web Push

```bash
node scripts/generate-vapid.mjs
```

Lệnh **chỉ in public key**. Private key được lưu trong file `~/.water-beo/vapid-private-key` với quyền chỉ chủ máy đọc.

- **PUBLIC KEY** được phép gửi cho ChatGPT để cập nhật `backend/wrangler.jsonc`.
- **PRIVATE KEY** không in trên Terminal. Khi đến bước 4, Wrangler đọc khóa trực tiếp từ file riêng trên Mac.
- Đừng làm mất khóa private. Đổi bộ khóa sẽ cần đăng ký lại Web Push trên iPhone.

## 3. Điền public key rồi deploy

Trong `backend/wrangler.jsonc`, thay `REPLACE_WITH_PUBLIC_VAPID_KEY` bằng public key. Nếu muốn, chỉ gửi public key cho ChatGPT và nhờ sửa trực tiếp trong repo; sau đó chạy:

```bash
cd ~/water-couple-setup
git pull --ff-only
cd backend
npx wrangler deploy
```

Worker sẽ có tên `water-beo-push`, giữ nguyên D1 `water-couple`. URL có dạng `https://water-beo-push.YOUR-SUBDOMAIN.workers.dev`.

## 4. Đặt secrets (không gửi qua Chat)

```bash
npx wrangler secret put VAPID_PRIVATE_KEY < ~/.water-beo/vapid-private-key
npx wrangler secret put OWNER_SETUP_CODE
```

- Lệnh đầu lấy **private key** từ file, không in ra màn hình.
- Tự đặt **OWNER_SETUP_CODE** dài ít nhất 16 ký tự, khó đoán và giữ kín. Đây là mã kích hoạt **một iPhone**.
- Kiểm tra lại bằng `npx wrangler secret list` (chỉ hiện tên secrets, không lộ giá trị).

Nếu cần, chạy `npx wrangler deploy` một lần nữa sau khi cấu hình.

## 5. Nối frontend GitHub Pages

Gửi ChatGPT **chỉ URL `workers.dev`** (không phải secret). ChatGPT sẽ điền URL công khai vào `push-config.js`, push code lên GitHub Pages.

## 6. Bật trên iPhone 12 Pro Max

1. Mở Water từ icon đã **Add to Home Screen** trên iPhone chạy iOS 16.4+.
2. Vào **Cài đặt → Thông báo cho Beo**, nhập **OWNER_SETUP_CODE** một lần và nhấn **Kích hoạt iPhone này**.
3. Trong **Cài đặt → Nhắc uống nước**, bật lịch, chọn giờ và nhấn **Lưu lịch nhắc**.
4. Quay lại **Thông báo cho Beo** → **Bật thông báo iPhone** → **Allow / Cho phép**.
5. Nhấn **Gửi thử thông báo**, sau đó khóa màn hình để kiểm chứng.
6. Muốn đổi điện thoại: ngắt kích hoạt máy cũ trước; dữ liệu uống nước cũ không tự chuyển, nên xuất JSON backup.

Thông báo có thể đến muộn, bị Focus chặn hoặc không nhận được khi không có mạng. Ứng dụng vẫn hoạt động offline nhưng không gửi lock-screen notification offline.

## Kiểm tra nếu có lỗi

- `GET /api/config` trả `ready:false`: thiếu VAPID keys hoặc `OWNER_SETUP_CODE`.
- `403` lúc kích hoạt: sai mã riêng.
- `409` lúc kích hoạt: đã có iPhone được kích hoạt.
- Nếu `test-push` 429: thử lại sau 2 phút.
- Nếu không thấy notification: đảm bảo mở từ icon Home Screen, cho phép thông báo trong Settings iPhone, kiểm tra Focus và Cloudflare Worker logs.

Tài liệu: https://developers.cloudflare.com/workers/configuration/secrets/ và https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/