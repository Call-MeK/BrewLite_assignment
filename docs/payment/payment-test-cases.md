# Test Cases – Payment

## 1. Phạm vi

Kiểm thử API `POST /api/v1/payments`, hai phương thức `E_WALLET`, `BANK_CARD`, xử lý kết quả từ Mock Payment Gateway và quy tắc Idempotency-Key.

## 2. Test Cases

| ID | Trường hợp kiểm thử | Kết quả mong đợi |
|---|---|---|
| TC-PAY-01 | Thanh toán bằng ví điện tử thành công | Payment `SUCCESS`, Order chuyển `PAID`, làm rỗng giỏ hàng |
| TC-PAY-02 | Thanh toán bằng thẻ ngân hàng thành công | Payment `SUCCESS`, Order chuyển `PAID`, làm rỗng giỏ hàng |
| TC-PAY-03 | Gateway trả thất bại | Payment `FAILED`, Order chuyển `PAYMENT_FAILED`, giỏ hàng giữ nguyên |
| TC-PAY-04 | Thiếu `orderId` | Từ chối request (`400 Bad Request`) |
| TC-PAY-05 | Thiếu `method` | Từ chối request (`400 Bad Request`) |
| TC-PAY-06 | `method` không hợp lệ | Từ chối request (`400 Bad Request`) |
| TC-PAY-07 | Order không tồn tại | Trả lỗi phù hợp (`404 Not Found`), không gọi gateway |
| TC-PAY-08 | Người dùng không có quyền thanh toán Order | Từ chối request (`403 Forbidden`) |
| TC-PAY-09 | Order đã thanh toán (ở trạng thái `PAID` hoặc khác `PENDING`/`PAYMENT_FAILED`) | Từ chối request với mã lỗi `409 Conflict` |
| TC-PAY-10 | Cùng key, cùng nội dung | Trả kết quả cũ đã lưu (HTTP 200), không tạo giao dịch trùng |
| TC-PAY-11 | Cùng key, nội dung khác (`requestHash` lệch) | Từ chối request (`409 Conflict`) |
| TC-PAY-12 | Nhiều request đồng thời dùng cùng key | Chỉ tạo một giao dịch logic trong CSDL; request thua cuộc nhận kết quả HTTP 200 đã lưu, không bị lỗi 500 |
| TC-PAY-13 | Thử lại sau thất bại với key mới | Chuyển Order `PAYMENT_FAILED → PENDING`, tạo Payment mới với Idempotency-Key mới, không giới hạn số lần thử |
| TC-PAY-14 | Gateway timeout | Ghi nhận Payment `FAILED` (`failureReason: "Gateway timeout"`), Order chuyển `PAYMENT_FAILED` |
| TC-PAY-15 | Thử lại sau khi Gateway timeout với key mới | Chuyển Order `PAYMENT_FAILED → PENDING`, thanh toán thành công chuyển `PAID` |
| TC-PAY-16 | Header `X-Mock-Outcome: FAILED` ở môi trường dev/test | Mock gateway giả lập thất bại, Payment `FAILED`, Order `PAYMENT_FAILED` |
| TC-PAY-17 | Frontend gửi số tiền không đúng | Backend vẫn tự trích xuất số tiền từ `Order.finalAmount` |
| TC-PAY-18 | Lần thử trước thất bại, lần sau thành công | Lưu lịch sử các lần thử (1-N) và cập nhật Order theo kết quả thành công |
| TC-PAY-19 | Header `X-Mock-Outcome: FAILED` ở môi trường production | Backend bỏ qua header khi `NODE_ENV === 'production'`, xử lý giao dịch thành công (`SUCCESS`), Order chuyển `PAID` |

## 3. Điều kiện nghiệm thu

- Các trường hợp hợp lệ và không hợp lệ được xử lý đúng.
- Trạng thái Payment và Order nhất quán theo State Machine chuẩn (lỗi chuyển `PAYMENT_FAILED`, thử lại chuyển `PENDING`).
- Idempotency hoạt động với request lặp và request đồng thời (không crash 500).
- Mock Payment Gateway hỗ trợ điều khiển qua header `X-Mock-Outcome` trong môi trường dev/test và tự vô hiệu hóa ở production.
- Kết quả kiểm thử thực tế phải được ghi nhận là Pass hoặc Fail sau khi Backend triển khai.

## 4. Lịch sử thay đổi
- v1.0 (2026-10-11): Khởi tạo danh mục Test Cases Payment.
- v1.1 – áp dụng quyết định D1, D8 (ngày 2026-10-16).

