# Database Mapping – Payment

## 1. Mục tiêu

Mô tả mapping giữa Prisma model `Payment`, model `Order` và các cột tương ứng trong PostgreSQL.

## 2. Mapping Payment

| Prisma field | Database column | Kiểu dữ liệu / Ý nghĩa |
|---|---|---|
| `id` | `id` | String, khóa chính |
| `orderId` | `order_id` | String, khóa ngoại tới `orders.id` |
| `idempotencyKey` | `idempotency_key` | String, duy nhất |
| `requestHash` | `request_hash` | String tùy chọn, dùng đối chiếu nội dung request |
| `amount` | `amount` | Decimal(12,0), số tiền giao dịch |
| `method` | `method` | Enum `E_WALLET` hoặc `BANK_CARD` |
| `status` | `status` | Enum `PENDING`, `SUCCESS`, `FAILED` |
| `failureReason` | `failure_reason` | String tùy chọn |
| `transactionRef` | `transaction_ref` | String tùy chọn, mã giao dịch |
| `createdAt` | `created_at` | DateTime, thời điểm tạo |

Tên bảng trong database: `payments`.

## 3. Quan hệ với Order và Chuyển đổi trạng thái

- **Quan hệ 1 - N (Order - Payments):** Một `Order` có thể liên kết với nhiều bản ghi `Payment` (quan hệ 1-N trong `schema.prisma`, trường `orderId` trong `payments` không có `@unique`) nhằm cho phép khách hàng thực hiện nhiều lượt thử thanh toán (Retry) khi các lượt trước bị thất bại.
- **Thanh toán thành công:** Khi bản ghi Payment đạt trạng thái `SUCCESS`:
  - `Order.status` chuyển từ `PENDING` sang `PAID` (thông qua `OrderService.transition`).
  - `Order.paidAt` lưu thời điểm thanh toán thành công (`now()`).
  - `Order.pointsEarned` được tích lũy và ghi nhận điểm thưởng vào bảng `users`.
- **Thanh toán thất bại (Áp dụng Quyết định D1):** Khi một bản ghi Payment chuyển trạng thái `FAILED`:
  - `Order.status` lập tức chuyển từ `PENDING` sang `PAYMENT_FAILED` thông qua `OrderService.transition` (KHÔNG giữ nguyên `PENDING`).
  - Giỏ hàng của khách hàng tại Frontend được giữ nguyên.
- **Quy tắc thử lại thanh toán (Retry):**
  - Khách hàng có thể bấm "Thử lại" không giới hạn số lần.
  - Khi thử lại, đơn hàng chuyển trạng thái `PAYMENT_FAILED → PENDING` (thông qua `OrderService.transition`), sau đó tạo bản ghi Payment mới với một `idempotencyKey` mới.
  - Đã gỡ bỏ toàn bộ quy định giới hạn tối đa 3 lần thử, thời hạn 15 phút, và việc khóa thanh toán vĩnh viễn ở `PAYMENT_FAILED`.

## 4. Các quy tắc dữ liệu

- `idempotencyKey` phải duy nhất toàn hệ thống (`@unique`).
- `amount` bắt buộc được trích xuất từ `Order.finalAmount` ở Backend, không tin cậy dữ liệu client.
- Không đánh dấu Order là `PAID` khi Payment thất bại.
- Không tạo giao dịch trùng khi nhận lại cùng `idempotencyKey` và cùng request hash/payload (trả về kết quả HTTP 200 đã lưu).
- Việc thử lại sau thất bại bắt buộc sử dụng `idempotencyKey` mới.

## 5. Lưu ý

Tài liệu này cần được đối chiếu với `schema.prisma` thực tế của nhóm trước khi migration. Kiểu dữ liệu PostgreSQL cuối cùng phụ thuộc schema và migration đã áp dụng.

## 6. Lịch sử thay đổi
- v1.0 (2026-10-11): Khởi tạo tài liệu DB Mapping Payment.
- v1.1 – áp dụng quyết định D1 (ngày 2026-10-16).

