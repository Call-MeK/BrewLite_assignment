# Use Case Specification – Payment

## 1. Thông tin chung

- **Use Case ID:** UC-PAY-01
- **Tên Use Case:** Thanh toán đơn hàng
- **Actor chính:** Khách hàng
- **Actor phụ:** Cổng thanh toán giả lập (Mock Payment Gateway)
- **Mục tiêu:** Cho phép khách hàng thanh toán đơn hàng bằng ví điện tử hoặc thẻ ngân hàng và nhận kết quả giao dịch.

## 2. Tiền điều kiện (Preconditions)

- Khách hàng đã đăng nhập.
- Đơn hàng tồn tại và thuộc quyền truy cập của khách hàng.
- Đơn hàng chưa được thanh toán và đủ điều kiện thanh toán.
- Backend và cơ sở dữ liệu hoạt động bình thường.

## 3. Luồng chính (Main Flow)

1. Khách hàng chọn đơn hàng cần thanh toán.
2. Hệ thống hiển thị số tiền cần thanh toán.
3. Khách hàng chọn ví điện tử hoặc thẻ ngân hàng.
4. Frontend gửi yêu cầu `POST /api/v1/payments` kèm `orderId`, `method` và `Idempotency-Key`.
5. Backend xác thực dữ liệu, quyền truy cập và trạng thái đơn hàng.
6. Backend kiểm tra `Idempotency-Key`.
7. Backend xác định số tiền thanh toán từ dữ liệu đơn hàng trong database.
8. Backend tạo bản ghi Payment với trạng thái `PENDING`.
9. Backend gửi yêu cầu đến Mock Payment Gateway.
10. Nếu thanh toán thành công, Backend cập nhật Payment thành `SUCCESS` và cập nhật đơn hàng thành `PAID`.
11. Hệ thống trả kết quả đã được bọc qua `TransformInterceptor` (`{ success: true, statusCode: 201, data: {...}, timestamp }`) để Frontend hiển thị cho khách hàng.

## 4. Luồng thay thế (Alternative Flows)

### A1 – Thanh toán thất bại

1. Cổng thanh toán giả lập trả kết quả thất bại (hoặc gateway timeout).
2. Backend cập nhật Payment thành `FAILED` kèm lý do thất bại.
3. Backend chuyển trạng thái đơn hàng `PENDING → PAYMENT_FAILED` thông qua `OrderService.transition`.
4. Frontend hiển thị thông báo thất bại và giữ nguyên giỏ hàng của khách hàng.
5. Khách hàng có thể chọn thử lại thanh toán không giới hạn số lần: hệ thống chuyển đơn hàng `PAYMENT_FAILED → PENDING` và thực hiện thanh toán với `Idempotency-Key` mới.

### A2 – Idempotency-Key đã tồn tại

- Nếu key và nội dung yêu cầu giống nhau, Backend trả lại kết quả đã lưu (HTTP 200). Request đồng thời dùng cùng key: request thua (lỗi unique) truy vấn và trả lại kết quả đã lưu (HTTP 200), không trả lỗi 500.
- Nếu key giống nhưng nội dung yêu cầu khác (`requestHash` lệch), Backend từ chối với mã lỗi `409 Conflict`.
- Không tạo giao dịch thanh toán trùng.

### A3 – Timeout từ cổng thanh toán

1. Khi yêu cầu sang Gateway bị timeout, hệ thống ghi nhận Payment là `FAILED` với lý do `"Gateway timeout"`.
2. Đơn hàng chuyển sang trạng thái `PAYMENT_FAILED` qua `OrderService.transition`.
3. Khách hàng có thể bấm "Thử lại" để chuyển đơn sang `PENDING` và thanh toán lại với key mới.

## 5. Hậu điều kiện (Postconditions)

- Thành công: Payment có trạng thái `SUCCESS`; Order chuyển sang trạng thái `PAID`; Giỏ hàng được xóa (`clearCart()` và xóa `pendingOrderId`); Tích lũy điểm thưởng loyalty.
- Thất bại: Payment có trạng thái `FAILED`; Order chuyển sang trạng thái `PAYMENT_FAILED`; Giỏ hàng được giữ nguyên để khách hàng có thể thử lại.

## 6. Acceptance Criteria

- Khách hàng có thể chọn một trong hai phương thức: `E_WALLET` hoặc `BANK_CARD`.
- Backend tự xác định số tiền từ đơn hàng, không tin số tiền do Frontend tự gửi.
- Thanh toán thành công cập nhật trạng thái đơn hàng thành `PAID` và làm rỗng giỏ hàng.
- Thanh toán thất bại chuyển đơn hàng thành `PAYMENT_FAILED`, giữ nguyên giỏ hàng.
- Cùng Idempotency-Key và cùng nội dung yêu cầu không tạo giao dịch trùng, trả về kết quả đã lưu.
- Cùng Idempotency-Key nhưng nội dung khác phải bị từ chối với lỗi 409 Conflict.
- Hỗ trợ thử lại thanh toán không giới hạn số lần với Idempotency-Key mới.

---

## 7. Quy tắc nghiệp vụ (Business Rules)

| Mã quy tắc | Tên quy tắc | Nội dung chi tiết |
| :--- | :--- | :--- |
| **BR-PAY-01** | Idempotency (Cơ chế chống trùng lặp) | Header `Idempotency-Key` là bắt buộc khi gọi `POST /api/v1/payments`.<br>- **Cùng key + cùng payload:** Backend trả lại kết quả đã lưu trong bảng `Payment` (HTTP 200) mà không tạo giao dịch mới hay gọi lại Mock Gateway.<br>- **Request đồng thời:** Request bị lỗi unique constraint truy vấn và trả kết quả đã lưu (HTTP 200), không trả 500.<br>- **Cùng key + khác payload (`requestHash`):** Backend từ chối với mã lỗi `409 Conflict`. |
| **BR-PAY-02** | Số tiền thanh toán từ CSDL (Amount Verification) | Số tiền thanh toán (`amount`) bắt buộc phải lấy từ trường `Order.finalAmount` trong database. Backend tuyệt đối không tin cậy và không sử dụng bất kỳ số tiền nào do Client tự gửi lên. |
| **BR-PAY-03** | Điều kiện trạng thái đơn hàng (Order State Precondition) | `POST /api/v1/payments` chỉ chấp nhận các đơn hàng đang ở trạng thái `PENDING` hoặc `PAYMENT_FAILED`. Nếu đơn hàng ở các trạng thái khác (`PAID`, `CANCELLED`, `PREPARING`...), Backend từ chối giao dịch với mã lỗi `409 Conflict`. |
| **BR-PAY-04** | Xử lý thanh toán thành công (Payment Success) | Khi Mock Gateway xác nhận thành công:<br>1. Cập nhật `Payment.status = SUCCESS`, lưu `transactionRef`.<br>2. Gọi `OrderService.transition(orderId, PAID)`, gán `Order.paidAt = now()`.<br>3. Ghi nhận lịch sử trạng thái vào `OrderStatusHistory` và tích lũy điểm thưởng loyalty (`Order.pointsEarned`) trong cùng transaction.<br>4. Client thực hiện xóa giỏ hàng (`clearCart()` và xóa `pendingOrderId`). |
| **BR-PAY-05** | Xử lý thanh toán thất bại (Payment Failure) | Khi Mock Gateway trả về kết quả thất bại (từ chối thẻ, không đủ số dư, timeout...):<br>1. Cập nhật bản ghi `Payment.status = FAILED`, lưu `failureReason`.<br>2. Gọi `OrderService.transition(orderId, PAYMENT_FAILED)` để chuyển trạng thái đơn hàng sang `PAYMENT_FAILED`.<br>3. Giữ nguyên giỏ hàng tại Frontend để khách hàng có thể thử lại hoặc đổi phương thức. |
| **BR-PAY-06** | Quy tắc thử lại thanh toán (Retry Policy) | Khi khách hàng thử lại sau một giao dịch thất bại (`PAYMENT_FAILED`), hệ thống chuyển đơn hàng `PAYMENT_FAILED → PENDING` qua `OrderService.transition`. Frontend **bắt buộc phải sinh một `Idempotency-Key` mới**. Hệ thống cho phép thử lại không giới hạn số lần (gỡ bỏ giới hạn 3 lần và thời hạn 15 phút). Mỗi lần thử lại sẽ tạo một bản ghi `Payment` mới liên kết với cùng `orderId`. |
| **BR-PAY-07** | Xử lý Timeout (Timeout Handling) | Khi yêu cầu sang Gateway bị timeout, Backend ghi nhận `Payment.status = FAILED` với `failureReason = "Gateway timeout"` và chuyển `Order.status = PAYMENT_FAILED`. Không duy trì trạng thái treo PENDING hay đối soát bất đồng bộ trong MVP. |

---

## 8. Kết luận các vấn đề thiết kế

### [Q1] Khi nào chuyển đơn hàng sang trạng thái `OrderStatus.PAYMENT_FAILED`?

**ĐÃ CHỐT (Quyết định D1):**
- Khi giao dịch thanh toán thất bại (gateway từ chối hoặc timeout), `Payment.status = FAILED` và đơn hàng lập tức chuyển sang `OrderStatus.PAYMENT_FAILED` thông qua `OrderService.transition`.
- Khách hàng được phép thử lại không giới hạn số lần: khi thử lại, đơn hàng chuyển `PAYMENT_FAILED → PENDING` và gửi thanh toán với `Idempotency-Key` mới.
- Gỡ bỏ toàn bộ quy định giới hạn 3 lần, 15 phút và khóa vĩnh viễn đơn hàng.

### [Q2] Thời gian chờ thanh toán tối đa (Payment Timeout Window)

**ĐÃ CHỐT (Quyết định D6):**
- Gỡ bỏ scheduler/cron-job tự động hết hạn 15 phút và trường `expiresAt` khỏi phạm vi MVP.
- **Giới hạn đã biết (Known Limitation):** Các đơn hàng ở trạng thái `PENDING` hoặc `PAYMENT_FAILED` nếu bị khách hàng bỏ dở sẽ tiếp tục giữ tồn kho cho đến khi được hủy thủ công thông qua `POST /orders/:id/cancel`.

## 9. Lịch sử thay đổi
- v1.0 (2026-10-11): Khởi tạo đặc tả Use Case Payment.
- v1.1 – áp dụng quyết định D1, D2, D6 (ngày 2026-10-16).

