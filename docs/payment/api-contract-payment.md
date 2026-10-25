# API Contract – Payment v1.2

> Triển khai v1.2 dùng mock cục bộ, không có gateway thật, QR, webhook, refund hoặc scheduler.
> Order hiện chưa có API tạo/hủy. Khi demo, cần một Order đã lưu trong DB thuộc user đăng nhập.
> `OrdersService.transition()` hiện chỉ triển khai ba chuyển tiếp phục vụ Payment; không thay thế toàn bộ Order module.

## 1. Endpoint

- **Method:** `POST`
- **URL:** `/api/v1/payments`
- **Content-Type:** `application/json`
- **Authentication:** Bearer Token
- **Idempotency:** Sử dụng header `Idempotency-Key`

## 2. Request

### Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: pay-order001-attempt001
X-Mock-Outcome: SUCCESS
```

### Body

```json
{
  "orderId": "order_001",
  "method": "E_WALLET"
}
```

`method` chỉ chấp nhận `E_WALLET` hoặc `BANK_CARD`. `Idempotency-Key` bắt buộc, không được toàn khoảng trắng, tối đa 255 ký tự. `orderId` phải là chuỗi không rỗng/toàn khoảng trắng. Trường ngoài DTO (kể cả `amount`, `userId`) bị từ chối với HTTP 400.

Backend phải lấy số tiền từ đơn hàng trong database, không sử dụng số tiền do Frontend gửi để quyết định số tiền giao dịch.

## 3. Phản hồi khi thành công (Success Response)

Tất cả các API thành công (`200 OK` hoặc `201 Created`) đều được bọc tự động qua `TransformInterceptor` theo quy chuẩn của nhóm (`docs/checklist-review.md`).

**HTTP Status:** `201 Created` (hoặc `200 OK` khi trả về kết quả idempotency đã hoàn tất trước đó).

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "payment_001",
    "orderId": "order_001",
    "amount": 65000,
    "method": "E_WALLET",
    "status": "SUCCESS",
    "transactionRef": "mock_txn_001",
    "failureReason": null,
    "createdAt": "2026-10-11T12:00:00.000Z"
  },
  "timestamp": "2026-10-11T12:00:00.000Z"
}
```

## 4. Phản hồi khi giao dịch thất bại hoặc lỗi

### 4.1. Giao dịch bị từ chối từ cổng thanh toán (Payment Failed)

Khi cổng thanh toán từ chối (hoặc tài khoản không đủ số dư), bản ghi Payment được cập nhật trạng thái `FAILED`, đồng thời đơn hàng chuyển trạng thái `PENDING → PAYMENT_FAILED` (thông qua `OrderService.transition`). Phản hồi trả về kết quả thanh toán thất bại trong `data`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "payment_001",
    "orderId": "order_001",
    "amount": 65000,
    "method": "E_WALLET",
    "status": "FAILED",
    "transactionRef": null,
    "failureReason": "Số dư không đủ hoặc thẻ bị khóa",
    "createdAt": "2026-10-11T12:00:00.000Z"
  },
  "timestamp": "2026-10-11T12:00:00.000Z"
}
```

- **Trạng thái đơn hàng (Order Status):** Khi thanh toán thất bại, đơn hàng chuyển sang `PAYMENT_FAILED`.
- **Thử lại thanh toán (Retry):** Khách hàng có thể thử lại thanh toán không giới hạn số lần. Khi khách hàng bấm "Thử lại", hệ thống chuyển đơn hàng `PAYMENT_FAILED → PENDING` (thông qua `OrderService.transition`), sau đó tiến hành thanh toán với một `Idempotency-Key` MỚI. Giỏ hàng tại Frontend được giữ nguyên khi thanh toán thất bại.
- **Mock cục bộ:** Chỉ mô phỏng `SUCCESS` / `FAILED`, không gọi mạng nên không có kịch bản network timeout. Lỗi DB/hệ thống rollback toàn bộ transaction, không giả lập thành công.

### 4.2. Phản hồi lỗi hệ thống / nghiệp vụ (Error Responses)

Khi xảy ra lỗi (Status code 400, 401, 403, 404, 409, 500), response được bọc tự động qua `AllExceptionsFilter`:

| HTTP Status | Trường hợp | Ví dụ `message` |
|---|---|---|
| `400 Bad Request` | Thiếu hoặc sai định dạng DTO | `["orderId must be a string", "method must be a valid enum value"]` |
| `401 Unauthorized` | Chưa đăng nhập hoặc token không hợp lệ | `"Unauthorized"` |
| `403 Forbidden` | Không có quyền thanh toán đơn hàng này | `"Bạn không có quyền thanh toán đơn hàng này"` |
| `404 Not Found` | Không tìm thấy đơn hàng | `"Không tìm thấy đơn hàng"` |
| `409 Conflict` | Đơn hàng không ở trạng thái `PENDING` hoặc `PAYMENT_FAILED` (ví dụ: đã `PAID`, `CANCELLED`, `PREPARING`...) | `"Đơn hàng không ở trạng thái hợp lệ để thanh toán"` |
| `409 Conflict` | Idempotency-Key trùng với nội dung request khác (`requestHash` không khớp) | `"Idempotency key đã được sử dụng với thông tin khác"` |
| `409 Conflict` | Payment vẫn PENDING | `"Giao dịch đang được xử lý, vui lòng thử lại với cùng key"` |
| `503 Service Unavailable` | Production, môi trường không hợp lệ hoặc demo chưa bật | `"Mock payment requires development/test and PAYMENT_DEMO_MODE=true"` |
| `500 Internal Server Error` | Lỗi máy chủ không mong muốn | `"Đã xảy ra lỗi không mong muốn"` |

**Ví dụ lỗi 409 Conflict:**
```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "message": "Idempotency key đã được sử dụng với thông tin khác",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "path": "/api/v1/payments"
}
```

## 5. Quy tắc Idempotency & Thử lại (Retry Policy)

- **Cùng key, cùng nội dung:** Backend trả lại kết quả giao dịch đã lưu trong `payments` (HTTP 200) mà không tạo Payment mới hay gọi lại Mock Gateway.
- Kiểm tra key trước khi từ chối Order đã PAID. Replay luôn kiểm tra chủ sở hữu từ JWT; không trả giao dịch của user khác. Hash SHA-256 bao gồm `orderId`, `method`, kết quả demo đã chuẩn hóa (không truyền header tương đương `SUCCESS`).
- Payment `PENDING` trả 409; key mới cũng không được mở lượt thanh toán khác khi Order có Payment PENDING hoặc SUCCESS.
- **Cùng key, khác nội dung (`requestHash`):** Backend ném `409 Conflict` từ chối yêu cầu.
- **Xử lý đồng thời (Concurrency):** Ràng buộc `unique` trên `idempotency_key` đảm bảo không bao giờ phát sinh 2 bản ghi thanh toán trùng nhau. Với các request đồng thời dùng cùng key, request thua cuộc (bị lỗi unique constraint) phải truy vấn và trả về kết quả đã lưu (HTTP 200), **tuyệt đối không được trả lỗi 500**.
- **Retry sau thất bại:** Khi giao dịch thất bại (`FAILED`), khách hàng bấm "Thử lại":
  1. Backend tự chuyển đơn hàng `PAYMENT_FAILED → PENDING` qua `OrdersService.transition` trong cùng transaction, Frontend không gọi API reset.
  2. Frontend **bắt buộc phải sinh một `Idempotency-Key` mới**.
  3. Hệ thống cho phép thử lại không giới hạn số lần (đã gỡ bỏ giới hạn 3 lần và thời hạn 15 phút).
- **Giỏ hàng:** Frontend KHÔNG xóa giỏ hàng khi tạo đơn hoặc khi thanh toán lỗi. Chỉ xóa giỏ hàng (`clearCart()` và xóa `pendingOrderId`) khi thanh toán `SUCCESS` (đơn hàng đạt trạng thái `PAID`).

## 6. Hợp đồng Mock Payment Gateway (Mock Gateway Contract)

Để phục vụ phát triển độc lập và kiểm thử tự động mà không phụ thuộc cổng thanh toán thực tế, hệ thống định nghĩa service `MockPaymentGatewayService` với các quy ước kịch bản như sau:

### 6.1. Service giả lập (không gọi mạng)

```typescript
resolveOutcome(header?: string): 'SUCCESS' | 'FAILED'; // Kiểm tra môi trường và header
pay(outcome: 'SUCCESS' | 'FAILED'); // Trả status, transactionRef, failureReason
```

### 6.2. Quy tắc kích hoạt kết quả Mock (Mock Trigger Rule - D8)

- **Cơ chế điều khiển qua Header:** Bỏ quy tắc kích hoạt theo hậu tố ID đơn hàng. Kết quả thanh toán giả lập được điều khiển trực tiếp qua HTTP Header:
  ```http
  X-Mock-Outcome: SUCCESS | FAILED
  ```
- **Mặc định:** Nếu không truyền header `X-Mock-Outcome`, Mock Gateway mặc định xử lý thành công (`SUCCESS`).
- **Bảo mật môi trường:** Chỉ cho phép thanh toán mô phỏng khi `NODE_ENV=development` hoặc `test` và `PAYMENT_DEMO_MODE=true`. Mọi cấu hình khác trả HTTP 503, không tạo Payment hay cập nhật Order, kể cả khi không gửi header. Header sai giá trị trong chế độ demo trả HTTP 400.

| Header `X-Mock-Outcome` | Môi trường | Kết quả trả về | Hành vi hệ thống |
|---|---|---|---|
| `SUCCESS` (hoặc không truyền) | `development` / `test` | `status: SUCCESS`, `transactionRef: "MOCK_TXN_..."` | Payment $\rightarrow$ `SUCCESS`, Order $\rightarrow$ `PAID` |
| `FAILED` | `development` / `test` | `status: FAILED`, `failureReason: "Giao dịch bị từ chối bởi cổng thanh toán mô phỏng"` | Payment $\rightarrow$ `FAILED`, Order $\rightarrow$ `PAYMENT_FAILED` |
| Bất kỳ / không truyền | `production` hoặc demo chưa bật | HTTP 503 | Không cập nhật Payment/Order |

Hai dòng development/test chỉ có hiệu lực khi `PAYMENT_DEMO_MODE=true`.

### 6.3. Transaction và concurrency

- Khóa hàng Order bằng PostgreSQL `SELECT ... FOR UPDATE` (tham số hóa), rồi kiểm tra lại key và trạng thái trong transaction.
- `OrdersService.transition(orderId, to, tx, changedBy, reason)` cập nhật có điều kiện `id/status/version`, tăng version và ghi history. Chỉ hỗ trợ `PENDING → PAID`, `PENDING → PAYMENT_FAILED`, `PAYMENT_FAILED → PENDING` trong phần tích hợp này.
- SUCCESS ghi `paidAt`, `pointsEarned = floor(finalAmount / 1000)`, tạo một LoyaltyTransaction EARNED và tăng User.loyaltyPoints trong cùng transaction. Lỗi ở bất kỳ bước nào rollback cả lượt thử và reset retry.
- FAILED lưu lý do, giữ tồn kho và không cộng điểm. Payment update có điều kiện status PENDING. Không thêm migration hoặc unique index loyalty; khóa Order và transition có điều kiện bảo vệ luồng này.

## 7. Lưu ý tích hợp Frontend & Backend

- Frontend hiển thị `amount` lấy từ đơn hàng, nhưng khi submit `POST /api/v1/payments` không gửi trường `amount` trong body. Backend tự trích xuất `finalAmount` từ Order.
- Frontend chịu trách nhiệm tự sinh UUID/CUID cho header `Idempotency-Key` mỗi lần gửi yêu cầu (và sinh key mới khi retry).
- **Demo:** Gửi `X-Mock-Outcome: SUCCESS` hoặc `FAILED` từ Postman. Không thay đổi Frontend trong Payment v1.2.
- **Duy trì giỏ hàng:** Khi thanh toán thất bại hoặc gặp lỗi 401, Frontend giữ nguyên giỏ hàng để khách hàng có thể thử lại hoặc đăng nhập. Chỉ gọi `clearCart()` và xóa `pendingOrderId` khi nhận kết quả `SUCCESS`.

## 8. Lịch sử thay đổi
- v1.2 (2026-10-21): Backend retry tự động, production fail closed, hash có demo context, pending conflict, transaction/loyalty/concurrency và JWT thật.
- v1.0 (2026-10-11): Khởi tạo tài liệu hợp đồng API Payment.
- v1.1 – áp dụng quyết định D1, D2, D8 (ngày 2026-10-16).

## 9. Kiểm tra bằng Postman và chạy test

Collection cục bộ ở `postman/collections/payment` chạy theo thứ tự health → đăng ký → đăng nhập → sản phẩm → chi tiết → tạo đơn → thanh toán. Chọn môi trường `postman/environments/BrewLite Local.environment.yaml`, hoặc chạy từ thư mục gốc:

```powershell
postman collection run postman/collections/payment -e "postman/environments/BrewLite Local.environment.yaml" --no-report-events
```

Trong Postman Desktop, chạy Orders rồi Payment trong cùng collection. Orders lưu `data.id` mới vào biến collection `latestOrderId`, và Payment dùng biến này; giá trị `orderId` cũ trong Environment không ảnh hưởng. Nếu collection được import trước khi sửa, hãy import lại từ `postman/collections/payment`.

Collection tạo tài khoản, đơn hàng và thanh toán mới trong database mà `baseUrl` trỏ tới; dùng database thử nghiệm nếu không muốn thêm dữ liệu vào database ứng dụng.

1. Trong `backend/.env`, đặt `NODE_ENV=development`, `PAYMENT_DEMO_MODE=true` và DATABASE_URL/JWT_SECRET hợp lệ; khởi động lại backend.
2. `GET /api/v1/products` để lấy `productId` có size `M`; `POST /api/v1/auth/register` hoặc `/auth/login` để lấy `data.accessToken`; sau đó `POST /api/v1/orders` với Bearer token và body `{"items":[{"productId":"<id>","size":"M","quantity":1}]}` để lấy Order PENDING.
3. `POST /api/v1/payments`, Authorization Bearer token, Content-Type application/json, Idempotency-Key `demo-attempt-1`, X-Mock-Outcome `FAILED`, body `{"orderId":"<id>","method":"E_WALLET"}`: HTTP 200, Payment FAILED, Order PAYMENT_FAILED.
4. Gửi lại nguyên request: cùng Payment id, không tăng số bản ghi. Đổi outcome hoặc method nhưng giữ key: HTTP 409.
5. Đổi key thành `demo-attempt-2`, outcome SUCCESS: HTTP 201, Order PAID; history có PAYMENT_FAILED → PENDING → PAID; loyalty tăng floor(finalAmount/1000) một lần.
6. Replay nguyên request SUCCESS: HTTP 200 cùng Payment id. Đổi key lần nữa: HTTP 409. Dùng JWT user khác: HTTP 403. Thiếu/sai JWT: HTTP 401.
7. Đặt NODE_ENV=production, khởi động lại backend: Payment trả 503, không ghi thanh toán mô phỏng thành công.

Test tự động dùng PostgreSQL thật với schema riêng (không dùng dữ liệu ứng dụng). Chạy từ `backend/` trong PowerShell:

```powershell
$env:PAYMENT_TEST_DATABASE_URL='postgresql://<user>:<password>@127.0.0.1:<port>/<db>?schema=payment_v12_test'
$env:DATABASE_URL=$env:PAYMENT_TEST_DATABASE_URL
npx prisma db push --skip-generate
npm run test:payment
npm test
npx prisma validate
npm run build
```

`db push` ở đây chỉ chuẩn bị schema kiểm thử riêng; không chạy với DATABASE_URL của ứng dụng. Test tạo user/order riêng và dọn đúng các bản ghi đó sau khi chạy, không reseed hoặc xóa dữ liệu khác.

