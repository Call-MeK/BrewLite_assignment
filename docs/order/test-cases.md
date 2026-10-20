# Test Cases: Order

> Feature: Order | Owner: Vo Thi Thuy | Phiên bản: v1
> Đây là bảng case test (thiết kế), chưa phải code test. Mỗi case dùng cho unit/integration test ở Sprint sau.

## 1. Chuyển trạng thái (Order State Machine)

### 1.1 Chuyển tiếp hợp lệ (phải cho phép)

| ID | Từ → Sang | Sự kiện | Kết quả mong đợi |
|---|---|---|---|
| TC-ST-01 | `PENDING → PAID` | Thanh toán thành công | Cho phép |
| TC-ST-02 | `PENDING → PAYMENT_FAILED` | Thanh toán lỗi | Cho phép |
| TC-ST-03 | `PENDING → CANCELLED` | Khách hủy | Cho phép theo State Machine; xử lý tồn kho theo quy tắc nghiệp vụ đã thống nhất |
| TC-ST-04 | `PAYMENT_FAILED → PENDING` | Thử lại | Cho phép |
| TC-ST-05 | `PAYMENT_FAILED → CANCELLED` | Hủy đơn qua `POST /orders/:id/cancel` | Cho phép, hoàn lại tồn kho trong transaction |
| TC-ST-06 | `PAID → PREPARING` | Barista nhận đơn | Cho phép |
| TC-ST-07 | `PAID → CANCELLED` | Hủy ở mức state machine / service | Cho phép theo State Machine chuẩn PDF (ngoài phạm vi MVP: không có endpoint/UI/hoàn tiền) |
| TC-ST-08 | `PREPARING → READY` | Pha xong | Cho phép |
| TC-ST-09 | `READY → COMPLETED` | Giao khách | Cho phép |

### 1.2 Chuyển tiếp sai (phải chặn)

Các chuyển tiếp không được State Machine cho phép phải bị từ chối và giữ nguyên trạng thái hiện tại. `409 Conflict` là mã HTTP trả về từ `assertTransition(from, to)`.

| ID | Từ → Sang | Lý do chặn | Kết quả mong đợi |
|---|---|---|---|
| TC-ST-10 | `PENDING → PREPARING` | Chưa thanh toán | Chặn, `409 Conflict` |
| TC-ST-11 | `PENDING → READY` | Nhảy cóc trạng thái | Chặn, `409 Conflict` |
| TC-ST-12 | `PENDING → COMPLETED` | Nhảy cóc trạng thái | Chặn, `409 Conflict` |
| TC-ST-13 | `PAYMENT_FAILED → PAID` | Không cho phép bỏ qua `PENDING` khi thử lại thanh toán | Chặn, `409 Conflict` |
| TC-ST-14 | `PAID → PENDING` | Không quay lui | Chặn, `409 Conflict` |
| TC-ST-15 | `PAID → READY` | Bỏ qua `PREPARING` | Chặn, `409 Conflict` |
| TC-ST-16 | `PREPARING → CANCELLED` | Barista đã pha, không hủy | Chặn, `409 Conflict` |
| TC-ST-17 | `PREPARING → PAID` | Không quay lui | Chặn, `409 Conflict` |
| TC-ST-18 | `READY → CANCELLED` | Đã pha xong, không hủy | Chặn, `409 Conflict` |
| TC-ST-19 | `COMPLETED → PAID` | Trạng thái kết thúc | Chặn, `409 Conflict` |
| TC-ST-20 | `COMPLETED → CANCELLED` | Trạng thái kết thúc | Chặn, `409 Conflict` |
| TC-ST-21 | `CANCELLED → PENDING` | Trạng thái kết thúc | Chặn, `409 Conflict` |
| TC-ST-22 | `CANCELLED → PAID` | Trạng thái kết thúc | Chặn, `409 Conflict` |
| TC-ST-23 | `PENDING → PENDING` | Chuyển về chính nó | Chặn, `409 Conflict` |

### 1.3 Kiểm thử toàn bộ (Unit test)

Duyệt toàn bộ 7 × 7 = 49 cặp trạng thái. Với đúng 9 cặp chuyển tiếp hợp lệ trong `TRANSITIONS` (TC-ST-01 đến TC-ST-09), kiểm tra `assertTransition(from, to)` không ném exception. Với 40 cặp còn lại, kiểm tra hàm ném `ConflictException`.

### 1.4 Đồng thời

| ID | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-ST-24 | Hai request đồng thời chuyển cùng một đơn từ `PENDING`, một sang `PAID`, một sang `CANCELLED` | Chỉ một request được cập nhật thành công (nhờ điều kiện `version` và `status = from`). Request còn lại nhận `409 Conflict`. |

## 2. Tạo đơn (`POST /orders`)

| ID | Tình huống | Input | Kết quả mong đợi |
|---|---|---|---|
| TC-CO-01 | Tạo đơn thành công | Bearer JWT hợp lệ, sản phẩm còn hàng, `items` hợp lệ (1..99) | `201 Created`, đơn có trạng thái `PENDING`, tổng tiền do backend tính đúng |
| TC-CO-02 | Giá do server tính | Client gửi thêm trường `price` hoặc `total` giả | Backend bỏ qua hoặc chặn; tổng tiền luôn tính từ CSDL |
| TC-CO-03 | Chưa đăng nhập | Không gửi Bearer JWT | `401 Unauthorized` |
| TC-CO-04 | JWT hết hạn | Token quá hạn | `401 Unauthorized` |
| TC-CO-05 | Giỏ hàng rỗng | `items: []` | `400 Bad Request`, không tạo đơn |
| TC-CO-06 | Số lượng bằng 0 | `quantity: 0` | `400 Bad Request`, không tạo đơn |
| TC-CO-07 | Số lượng vượt ngưỡng tối đa (D5) | `quantity: 100` (giới hạn là 1..99) | `400 Bad Request` |
| TC-CO-08 | Số lượng biên trên hợp lệ (D5) | `quantity: 99` | Tạo đơn thành công nếu đủ tồn kho |
| TC-CO-09 | Kích cỡ không hợp lệ | `size: "XL"` | `400 Bad Request`, không tạo đơn |
| TC-CO-10 | Sản phẩm không tồn tại | `productId` không tồn tại trong DB | `400 Bad Request` |
| TC-CO-11 | Topping không tồn tại hoặc không hợp lệ | `toppingIds` chứa ID không hợp lệ | `400 Bad Request` |
| TC-CO-11a | Chọn quá 3 topping mỗi món | `toppingIds` có 4 phần tử | `400 Bad Request` (`@ArrayMaxSize(3)`) |
| TC-CO-11b | Trùng lặp topping | `toppingIds` chứa ID trùng lặp | `400 Bad Request` (`@ArrayUnique()`) |
| TC-CO-12 | DTO không chứa userId (D4) | Request body chứa `userId` | `ValidationPipe` loại bỏ (whitelist) hoặc báo lỗi nếu có `forbidNonWhitelisted` |
| TC-CO-13 | Hết tồn kho sản phẩm | `quantity` lớn hơn `stock` | `400 Bad Request` (khớp TS-E2E-STOCK-01), tồn kho không âm |
| TC-CO-14 | Hết hàng ở sản phẩm thứ hai trong đơn | Sản phẩm thứ nhất đủ, sản phẩm thứ hai thiếu | `400 Bad Request`; transaction rollback, tồn kho sản phẩm thứ nhất không bị trừ |
| TC-CO-15 | Đặt đồng thời món cuối (Optimistic Lock) | `stock = 1`, hai request cùng đặt `quantity = 1` | Đúng 1 đơn thành công (`201`), 1 đơn nhận `400 Bad Request`, tồn kho = 0 |
| TC-CO-16 | Nhiều request đặt đồng thời | `stock = 5`, mười request cùng đặt `quantity = 1` | Đúng 5 request thành công (`201`), 5 request nhận `400 Bad Request` |
| TC-CO-17 | Lỗi DB khi tạo `OrderItem` | Giả lập lỗi trong transaction | Request thất bại; transaction rollback toàn bộ |
| TC-CO-18 | Áp dụng mã khuyến mãi hợp lệ (D7) | `promotionCode: "GIAM15K"` | `201 Created`, tính đúng `discountAmount` và `finalAmount` |
| TC-CO-19 | Mã khuyến mãi hết hạn hoặc không đủ điều kiện | `promotionCode` không hợp lệ | `400 Bad Request` |

## 3. Hủy đơn (`POST /orders/:id/cancel` - D6)

| ID | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-CX-01 | Khách hủy đơn ở trạng thái `PENDING` | `200 OK`, `Order.status = CANCELLED`, hoàn lại tồn kho Product và Topping trong transaction |
| TC-CX-02 | Khách hủy đơn ở trạng thái `PAYMENT_FAILED` | `200 OK`, `Order.status = CANCELLED`, hoàn lại tồn kho trong transaction |
| TC-CX-03 | Khách cố hủy đơn đã thanh toán (`PAID`) hoặc đang pha (`PREPARING`) | `409 Conflict`, không cho phép hủy |
| TC-CX-04 | Hủy đơn của người dùng khác | `404 Not Found` (cô lập dữ liệu, không làm lộ sự tồn tại của đơn) |
| TC-CX-05 | Chưa đăng nhập khi hủy đơn | `401 Unauthorized` |

## 4. Ma trận kiểm tra khớp (Flow ↔ State Machine)

| Flow | Case liên quan | Trạng thái đơn / Kết quả mong đợi |
|---|---|---|
| Main flow tạo đơn | TC-CO-01 | Tạo đơn thành công, trạng thái ban đầu là `PENDING` |
| Dữ liệu tạo đơn không hợp lệ | TC-CO-05 đến TC-CO-12 | Request bị từ chối; không tạo đơn thành công |
| Thiếu hoặc hết hạn JWT | TC-CO-03, TC-CO-04 | Trả về `401 Unauthorized` |
| Hết tồn kho hoặc có cạnh tranh đặt hàng | TC-CO-13 đến TC-CO-16 | Tối đa bằng tồn kho thành công, còn lại trả `400 Bad Request` |
| Lỗi trong transaction tạo đơn | TC-CO-14, TC-CO-17 | Transaction rollback toàn bộ |
| Thanh toán thành công | TC-ST-01 | `PENDING → PAID`, cộng điểm loyalty trong cùng transaction |
| Thanh toán thất bại | TC-ST-02 | `PENDING → PAYMENT_FAILED`, giữ nguyên giỏ hàng client |
| Thử lại sau thanh toán thất bại | TC-ST-04 | `PAYMENT_FAILED → PENDING`, thanh toán với key mới |
| Khách hủy đơn | TC-ST-03, TC-ST-05, TC-CX-01, TC-CX-02 | Chuyển sang `CANCELLED`, hoàn tồn kho nguyên tử |
| Hủy đơn đã thanh toán | TC-ST-07 | Chỉ có ở mức State Machine/Service (chuẩn PDF), không có endpoint/UI MVP |
| Chuyển trạng thái không hợp lệ | TC-ST-10 đến TC-ST-23 | Từ chối với `409 Conflict` |

## 5. Lịch sử thay đổi
- v1.0 (2026-10-10): Khởi tạo danh mục Test Cases Order.
- v1.1 – áp dụng quyết định D1, D4, D5, D6, D7 (ngày 2026-10-16).
