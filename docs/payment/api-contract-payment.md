# API Contract – Payment

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
```

### Body

```json
{
  "orderId": "order_001",
  "method": "E_WALLET"
}
```

`method` chỉ chấp nhận `E_WALLET` hoặc `BANK_CARD`.

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
- **Xử lý Timeout:** Gateway timeout được coi là `FAILED` với `failureReason: "Gateway timeout"` và đơn hàng chuyển sang `PAYMENT_FAILED` (không duy trì trạng thái treo PENDING hay đối soát bất đồng bộ trong MVP).

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
- **Cùng key, khác nội dung (`requestHash`):** Backend ném `409 Conflict` từ chối yêu cầu.
- **Xử lý đồng thời (Concurrency):** Ràng buộc `unique` trên `idempotency_key` đảm bảo không bao giờ phát sinh 2 bản ghi thanh toán trùng nhau. Với các request đồng thời dùng cùng key, request thua cuộc (bị lỗi unique constraint) phải truy vấn và trả về kết quả đã lưu (HTTP 200), **tuyệt đối không được trả lỗi 500**.
- **Retry sau thất bại:** Khi giao dịch thất bại (`FAILED`), khách hàng bấm "Thử lại":
  1. Frontend chuyển đơn hàng `PAYMENT_FAILED → PENDING` qua `OrderService.transition`.
  2. Frontend **bắt buộc phải sinh một `Idempotency-Key` mới**.
  3. Hệ thống cho phép thử lại không giới hạn số lần (đã gỡ bỏ giới hạn 3 lần và thời hạn 15 phút).
- **Giỏ hàng:** Frontend KHÔNG xóa giỏ hàng khi tạo đơn hoặc khi thanh toán lỗi. Chỉ xóa giỏ hàng (`clearCart()` và xóa `pendingOrderId`) khi thanh toán `SUCCESS` (đơn hàng đạt trạng thái `PAID`).

## 6. Hợp đồng Mock Payment Gateway (Mock Gateway Contract)

Để phục vụ phát triển độc lập và kiểm thử tự động mà không phụ thuộc cổng thanh toán thực tế, hệ thống định nghĩa service `MockPaymentGatewayService` với các quy ước kịch bản như sau:

### 6.1. Interface giả lập

```typescript
export interface MockPaymentRequest {
  orderId: string;
  amount: number;
  method: 'E_WALLET' | 'BANK_CARD';
  paymentRef: string;
  mockOutcome?: 'SUCCESS' | 'FAILED';
}

export interface MockPaymentResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED';
  transactionRef?: string;
  failureReason?: string;
}
```

### 6.2. Quy tắc kích hoạt kết quả Mock (Mock Trigger Rule - D8)

- **Cơ chế điều khiển qua Header:** Bỏ quy tắc kích hoạt theo hậu tố ID đơn hàng. Kết quả thanh toán giả lập được điều khiển trực tiếp qua HTTP Header:
  ```http
  X-Mock-Outcome: SUCCESS | FAILED
  ```
- **Mặc định:** Nếu không truyền header `X-Mock-Outcome`, Mock Gateway mặc định xử lý thành công (`SUCCESS`).
- **Bảo mật môi trường:** Backend chỉ đọc header `X-Mock-Outcome` khi biến môi trường `NODE_ENV !== 'production'`. Trong môi trường `production`, header này luôn bị bỏ qua và giao dịch được coi là thành công.

| Header `X-Mock-Outcome` | Môi trường | Kết quả trả về | Hành vi hệ thống |
|---|---|---|---|
| `SUCCESS` (hoặc không truyền) | `development` / `test` | `status: SUCCESS`, `transactionRef: "MOCK_TXN_..."` | Payment $\rightarrow$ `SUCCESS`, Order $\rightarrow$ `PAID` |
| `FAILED` | `development` / `test` | `status: FAILED`, `failureReason: "Giao dịch bị từ chối bởi cổng thanh toán mô phỏng"` | Payment $\rightarrow$ `FAILED`, Order $\rightarrow$ `PAYMENT_FAILED` |
| Bất kỳ giá trị nào | `production` | Luôn bỏ qua header, xử lý thành công | Payment $\rightarrow$ `SUCCESS`, Order $\rightarrow$ `PAID` |

## 7. Lưu ý tích hợp Frontend & Backend

- Frontend hiển thị `amount` lấy từ đơn hàng, nhưng khi submit `POST /api/v1/payments` không gửi trường `amount` trong body. Backend tự trích xuất `finalAmount` từ Order.
- Frontend chịu trách nhiệm tự sinh UUID/CUID cho header `Idempotency-Key` mỗi lần gửi yêu cầu (và sinh key mới khi retry).
- **Công tắc mô phỏng trên UI:** Màn hình thanh toán Frontend có công tắc "Mô phỏng: Thành công / Thất bại". Công tắc này chỉ hiển thị khi `NEXT_PUBLIC_DEMO_MODE=true` (khai báo trong `.env.example`). Khi bật công tắc thất bại, Frontend gửi kèm header `X-Mock-Outcome: FAILED`.
- **Duy trì giỏ hàng:** Khi thanh toán thất bại hoặc gặp lỗi 401, Frontend giữ nguyên giỏ hàng để khách hàng có thể thử lại hoặc đăng nhập. Chỉ gọi `clearCart()` và xóa `pendingOrderId` khi nhận kết quả `SUCCESS`.

## 8. Lịch sử thay đổi
- v1.0 (2026-10-11): Khởi tạo tài liệu hợp đồng API Payment.
- v1.1 – áp dụng quyết định D1, D2, D8 (ngày 2026-10-16).

