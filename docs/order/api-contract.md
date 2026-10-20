# API Contract: Order

> **Feature:** Order | **Owner:** Tôn Thất Hạnh | **Version:** v1.1 (Official Contract aligned with Design Decisions D1–D9)

> **Lưu ý:** Hợp đồng API được xây dựng dựa trên backend NestJS và Prisma schema hiện tại. Các quyết định thiết kế D1–D9 đã được áp dụng đầy đủ để làm chuẩn cho quá trình triển khai.

---

## 1. POST /orders — Tạo đơn hàng

|     Mục      |                                  Nội dung                                   |
|--------------|-----------------------------------------------------------------------------|
|    Mô tả     | Tạo đơn hàng mới với trạng thái ban đầu `PENDING`, kiểm tra dữ liệu đặt hàng, xác minh sản phẩm và topping, kiểm tra và cập nhật tồn kho (Optimistic Lock cho Product, có điều kiện cho Topping) trong transaction, tính toán giá server-side và áp dụng mã khuyến mãi. |
|     Auth     | **Bắt buộc JWT** (`Authorization: Bearer <JWT>`). Backend trích xuất `userId` từ token (`req.user.sub`), tuyệt đối không nhận `userId` từ request body nhằm bảo đảm an toàn danh tính (Quyết định D4). |
| Content-Type | `application/json` |
|   Endpoint   | `POST /api/v1/orders` |

### Request body

Cấu trúc request chuẩn gửi từ Client/Giỏ hàng:

```json
{
  "items": [
    {
      "productId": "cmv19kpye000794rc6vgebmpz",
      "size": "M",
      "quantity": 2,
      "toppingIds": [
        "cmv19top000294rc6vgebmp2"
      ]
    }
  ],
  "promotionCode": "GIAM15K"
}
```

### Giải thích các trường

|    Trường    |      Kiểu dữ liệu    | Bắt buộc |              Ý nghĩa                |
|--------------|----------------------|:--------:|-------------------------------------|
|   `items`    |        Array         | Có       | Danh sách mặt hàng trong đơn        |
|  `productId` |        String        | Có       | ID sản phẩm (CUID)                  |
|    `size`    |        String        | Không    | Kích cỡ sản phẩm: `S`, `M` hoặc `L` (mặc định `M`) |
|  `quantity`  |        Number        | Có       | Số lượng sản phẩm mỗi dòng: từ `1` đến `99` (Quyết định D5) |
| `toppingIds` |    Array of String   | Không    | Danh sách ID topping (không trùng lặp, tối đa 3 topping mỗi món, mặc định `[]`) |
| `promotionCode` |     String         | Không    | Mã khuyến mãi tùy chọn (Quyết định D7) |

**Quy tắc:** Giá sản phẩm, giá topping, tổng tiền và trạng thái đơn hàng do backend xác định. Client không được tự gửi giá cuối cùng hoặc trạng thái đơn để quyết định kết quả tạo đơn.

### Quy tắc kiểm tra dữ liệu đầu vào (DTO Validation)

| Trường | Kiểu dữ liệu | Bắt buộc | Quy tắc |
|---|---|---|---|
| `items` | Array | Có | Danh sách mặt hàng không được rỗng (`@ArrayNotEmpty()`). |
| `items[].productId` | String | Có | ID sản phẩm tồn tại và khả dụng (`isAvailable = true`). |
| `items[].size` | String | Không | Kích cỡ hợp lệ thuộc enum `ProductSize`: `S`, `M` hoặc `L`. |
| `items[].quantity` | Number | Có | Số nguyên từ `1` đến `99` (`@IsInt()`, `@Min(1)`, `@Max(99)` - Quyết định D5). |
| `items[].toppingIds` | Array of String | Không | Danh sách ID topping; không chấp nhận ID trùng lặp (`@ArrayUnique()`), tối đa 3 topping (`@ArrayMaxSize(3)`), topping phải khả dụng và còn tồn kho. |
| `promotionCode` | String | Không | Mã chuỗi nếu có (`@IsOptional()`, `@IsString()`). Bắt buộc khai báo trong DTO để tránh lỗi `forbidNonWhitelisted: true` (Quyết định D7). |

### Công thức tính giá phía Server:
- `unitPrice = basePrice + sizeAdjustment` (Size S: +0đ, Size M: +5.000đ, Size L: +10.000đ theo seed).
- `lineTotal = (unitPrice + Σ toppingPrice) × quantity`.
- `totalAmount = Σ lineTotal`.
- `discountAmount`: do `PromotionsService.validate(promotionCode, totalAmount)` tính toán (mã hợp lệ, còn hạn, đạt `minOrderAmount`).
- `finalAmount = Math.max(0, totalAmount - discountAmount)`.

### Response 201 Created

Response mẫu bọc tự động qua `TransformInterceptor` (Ví dụ: Cà phê Americano basePrice 40.000đ + size M 5.000đ = unitPrice 45.000đ; topping Kem Cheese 10.000đ; quantity 2; lineTotal = (45.000 + 10.000) × 2 = 110.000đ):

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "cmv5t0qeq0000mq6wzi4wzbl2",
    "orderNumber": 1042,
    "userId": "cmv5p022t0000mq44nt7fyszo",
    "status": "PENDING",
    "totalAmount": 110000,
    "discountAmount": 0,
    "finalAmount": 110000,
    "items": [
      {
        "productId": "cmv19kpye000794rc6vgebmpz",
        "size": "M",
        "quantity": 2,
        "unitPrice": 45000,
        "lineTotal": 110000,
        "toppings": [
          {
            "toppingId": "cmv19top000294rc6vgebmp2",
            "price": 10000
          }
        ]
      }
    ],
    "payments": [],
    "statusHistory": [
      {
        "fromStatus": null,
        "toStatus": "PENDING",
        "changedBy": "system",
        "reason": "Order created"
      }
    ]
  },
  "timestamp": "2026-10-16T10:00:00.000Z"
}
```

**Lưu ý:**
- Phía Frontend **KHÔNG xóa giỏ hàng** khi nhận phản hồi 201 Created; Frontend lưu `pendingOrderId` vào Zustand store và giữ nguyên các món trong giỏ (Quyết định D2). Chỉ xóa giỏ khi thanh toán `SUCCESS` (đơn chuyển `PAID`).
- `fromStatus: null` khi tạo đơn mới đang là Open Item (chi tiết tại Mục 5).

### Các mã lỗi của POST /orders

| HTTP Status | Trường hợp | Ghi chú |
|---|---|---|
| `400 Bad Request` | Dữ liệu không hợp lệ, số lượng ngoài `1..99`, sản phẩm/topping hết hàng hoặc ngưng bán, mã khuyến mãi không hợp lệ | Trả thông báo lỗi rõ ràng. Với lỗi hết hàng: trả `400 Bad Request` (khớp tiêu chuẩn TS-E2E-STOCK-01). |
| `401 Unauthorized` | Thiếu Bearer Token JWT hoặc token hết hạn | Trả về `401 Unauthorized`. Frontend giữ nguyên giỏ hàng và điều hướng sang trang Đăng nhập. |
| `409 Conflict` | Xung đột phiên bản dữ liệu đồng thời | Bị chặn bởi cơ chế Optimistic Locking khi có cạnh tranh cao. |
| `500 Internal Server Error` | Lỗi máy chủ không mong muốn | Được bọc qua `AllExceptionsFilter`. Không trả thông tin nhạy cảm của hệ thống cho client. |

---

## 2. Endpoint liên quan

| Endpoint | Feature | Ý nghĩa | Trạng thái |
|---|---|---|---|
| `GET /api/v1/orders/me` | History | Trả danh sách đơn hàng của người dùng hiện tại (chi tiết xem tài liệu `order-history/`). | Đã thống nhất với feature Order History |
| `POST /api/v1/orders/:id/cancel` | Order | Yêu cầu hủy đơn hàng (chỉ áp dụng cho đơn `PENDING` hoặc `PAYMENT_FAILED`). Hoàn tồn kho trong cùng transaction (Quyết định D6). | **Chính thức (Quyết định D6)** |

### Đặc tả chi tiết: POST /orders/:id/cancel (Khách hàng hủy đơn - D6)

| Mục | Nội dung |
|---|---|
| Mô tả | Khách hàng chủ động hủy đơn hàng đang chờ thanh toán (`PENDING`) hoặc thanh toán lỗi (`PAYMENT_FAILED`). Hoàn lại tồn kho cho Product và Topping trong cùng transaction. |
| Auth | **Bắt buộc JWT** (`Authorization: Bearer <JWT>`). Chỉ chủ đơn (`req.user.sub === order.userId`) mới có quyền hủy. |
| Endpoint | `POST /api/v1/orders/:id/cancel` |

**Quy tắc xử lý nghiệp vụ:**
1. Trích xuất `userId` từ `req.user.sub`.
2. Tìm đơn hàng theo `id`. Nếu đơn hàng không tồn tại hoặc `order.userId !== userId`: ném lỗi `404 Not Found` (để bảo mật, không làm lộ sự tồn tại của đơn hàng thuộc người khác).
3. Kiểm tra trạng thái đơn hàng: Chỉ cho phép hủy khi trạng thái hiện tại là `PENDING` hoặc `PAYMENT_FAILED`. Nếu đơn ở trạng thái khác (`PAID`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`): ném lỗi `409 Conflict`.
4. Thực thi trong transaction:
   - Chuyển trạng thái sang `CANCELLED` qua `OrderService.transition`.
   - Hoàn trả số lượng tồn kho cho các sản phẩm: tăng `Product.stock` theo `quantity`, tăng `Product.version`.
   - Hoàn trả số lượng tồn kho cho các toppings tương ứng (`Topping.stock = Topping.stock + quantity`).
   - Ghi nhận bản ghi `OrderStatusHistory` với `toStatus = CANCELLED`, `reason = "Customer cancelled"`.

**Response 200 OK:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "cmv5t0qeq0000mq6wzi4wzbl2",
    "orderNumber": 1042,
    "status": "CANCELLED"
  },
  "timestamp": "2026-10-16T10:05:00.000Z"
}
```

---

## 3. Mapping dữ liệu → Order / OrderItem

### 3.1. Mapping Order

| Nguồn (request / hệ thống) | Đích (Database / Prisma) | Ghi chú / Quy tắc nghiệp vụ |
|---|---|---|
| `req.user.sub` (Bearer JWT) | `Order.userId` | Backend trích xuất từ JWT token qua `JwtAuthGuard`; không nhận từ client body (Quyết định D4). |
| (hệ thống) | `Order.status = PENDING` | Trạng thái ban đầu của đơn hàng. |
| (hệ thống sinh tự động) | `Order.orderNumber` | Mã số đơn hiển thị (Int, autoincrement). |
| (hệ thống) | `Order.createdAt` | Thời điểm tạo đơn, theo database server. |
| Tổng tiền các dòng hàng | `Order.totalAmount` | Backend tính giá phía server (`Σ lineTotal`). |
| `PromotionsService.validate` | `Order.discountAmount` | Giá trị giảm giá do server tính toán; mặc định 0 nếu không áp dụng mã hợp lệ (Quyết định D7). |
| `PromotionsService.validate` | `Order.promotionId` | Khóa ngoại tới `Promotion.id` nếu mã hợp lệ; `null` nếu không có (Quyết định D7). |
| Tổng tiền sau giảm giá | `Order.finalAmount` | Số tiền thực trả (= Math.max(0, totalAmount - discountAmount)). |
| (hệ thống) | `Order.version = 0` | Khởi tạo phiên bản phục vụ optimistic locking của Order. |

### 3.2. Mapping OrderItem

| Nguồn (request / hệ thống) | Đích (Database / Prisma) | Ghi chú / Quy tắc nghiệp vụ |
|---|---|---|
| `items[].productId` | `OrderItem.productId` | ID sản phẩm (FK -> `Product.id`). |
| `items[].size` | `OrderItem.size` | Kích cỡ hợp lệ: `S`, `M`, `L` (enum `ProductSize`). |
| `items[].quantity` | `OrderItem.quantity` | Số lượng đặt mua: từ `1` đến `99` (Quyết định D5). |
| (hệ thống) | `OrderItem.orderId` | Khóa ngoại liên kết tới đơn hàng vừa tạo (`Order.id`). |
| Giá sản phẩm trong DB và phụ phí kích cỡ | `OrderItem.unitPrice` | Server tính: `basePrice + priceAdjustment(size)`, không tin giá client. |
| Giá sản phẩm, phụ phí kích cỡ, topping và số lượng | `OrderItem.lineTotal` | Server tính: `(unitPrice + Σ toppingPrice) × quantity`. |
| `items[].toppingIds` | `OrderItemTopping` | Backend tạo các bản ghi `OrderItemTopping` với `orderItemId`, `toppingId`, `price` (giá chốt tại thời điểm đặt). |

### 3.3. Cập nhật tồn kho (Quyết định D3)

| Nguồn | Thao tác | Ghi chú |
|---|---|---|
| `Product.stock` & `Product.version` | Giảm tồn kho sản phẩm bằng Optimistic Lock | `updateMany({ where: { id, version: currentVersion, stock: { gte: qty } }, data: { stock: { decrement: qty }, version: { increment: 1 } } })`. Nếu 0 dòng cập nhật → rollback & ném `400 Bad Request` (hết hàng/xung đột). |
| `Topping.stock` | Giảm tồn kho topping bằng Conditional Update | `updateMany({ where: { id: toppingId, stock: { gte: qty } }, data: { stock: { decrement: qty } } })`. Nếu 0 dòng cập nhật → rollback & ném `400 Bad Request` (hết topping). Topping không có cột `version`. |
| Lỗi trong quá trình tạo đơn | Rollback transaction | Prisma `$transaction` tự động rollback toàn bộ nếu bất kỳ bước nào thất bại. |

---

## 4. `assertTransition` (NestJS State Machine)

Hệ thống quản lý trạng thái đơn hàng đảm bảo đúng **9 chuyển tiếp giữa các trạng thái (+ 1 bước khởi tạo)** theo đúng sơ đồ trang 8 của đề bài PDF:

```ts
// order-state.ts
import { ConflictException } from '@nestjs/common';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Đúng 9 chuyển tiếp giữa các trạng thái
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED, // Giữ ở mức State Machine/Service theo PDF, ngoài scope MVP
  ],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new ConflictException(`Invalid order transition: ${from} -> ${to}`);
  }
}
```

### Cách sử dụng dự kiến

`OrderService.transition(orderId, to)` là **nơi duy nhất** được phép ghi `Order.status`:

1. Đọc trạng thái và phiên bản hiện tại của đơn hàng.
2. Gọi `assertTransition(from, to)` để kiểm tra tính hợp lệ.
3. Cập nhật trạng thái có điều kiện theo ID, trạng thái cũ và version (`where: { id, status: from, version }`).
4. Nếu không có bản ghi nào được cập nhật do trạng thái đã thay đổi đồng thời, trả về `409 Conflict`.
5. Ghi lịch sử thay đổi trạng thái vào `OrderStatusHistory` trong cùng transaction.

---

## 5. Luồng xử lý `POST /orders` (tóm tắt cho Backend)

1. **Nhận request:** Controller nhận dữ liệu tạo đơn hàng theo `CreateOrderDto` (không có `userId` trong body - Quyết định D4). Lấy `userId = req.user.sub` qua `JwtAuthGuard`.
2. **Kiểm tra dữ liệu (DTO Validation):** Kiểm tra `items` không rỗng, `1 <= quantity <= 99` (Quyết định D5), `size` thuộc `S, M, L`, `toppingIds` mảng chuỗi duy nhất tối đa 3 phần tử, và `promotionCode?: string` (Quyết định D7).
3. **Xác minh dữ liệu:** Kiểm tra người dùng, sản phẩm (`isAvailable = true`), topping (`isAvailable = true`), kiểm tra tồn kho đủ đáp ứng.
4. **Tính tiền:**
   - Server tính `unitPrice = basePrice + sizeAdjustment`.
   - `lineTotal = (unitPrice + Σ toppingPrice) × quantity`.
   - `totalAmount = Σ lineTotal`.
   - Gọi `PromotionsService.validate(promotionCode, totalAmount)` để tính `discountAmount`.
   - `finalAmount = Math.max(0, totalAmount - discountAmount)`.
5. **Transaction (`$transaction`):**
   - Trừ tồn kho Product (Optimistic Locking: `stock >= qty`, `version: currentVersion`, tăng `version`).
   - Trừ tồn kho Topping (Conditional Update: `stock >= qty`).
   - Tạo bản ghi `Order` (`PENDING`, `totalAmount`, `discountAmount`, `finalAmount`, `promotionId`).
   - Tạo các bản ghi `OrderItem` và `OrderItemTopping`.
   - Tạo bản ghi `OrderStatusHistory` (`fromStatus: null`, `toStatus: PENDING`, `reason: "Order created"`).
6. **Trả response:** Trả HTTP `201 Created` bọc qua `TransformInterceptor`. Frontend lưu `pendingOrderId`, giữ nguyên giỏ hàng (Quyết định D2).

### Trạng thái các điểm xác nhận & Open Item

- **Xác thực (Đã chốt - D4):** `JwtAuthGuard` được áp dụng cho toàn bộ endpoint tạo/hủy đơn. Danh tính lấy từ `req.user.sub`.
- **Khuyến mãi (Đã chốt - D7):** `promotionCode?: string` được khai báo trong DTO và xử lý qua `PromotionsService`.
- **Hạn thanh toán & Scheduler (Đã chốt - D6):** Gỡ bỏ scheduler tự hết hạn 15 phút và trường `expiresAt` khỏi MVP. Đơn bỏ dở sẽ giữ tồn kho cho đến khi hủy thủ công qua `POST /orders/:id/cancel`.
- **Cập nhật tồn kho đồng thời (Đã chốt - D3):** Product dùng cột `version` cho Optimistic Lock; Topping dùng cập nhật có điều kiện `stock >= qty`.
- **Mã lỗi (Đã chốt):** Hết hàng trả `400 Bad Request` (khớp test TS-E2E-STOCK-01); chuyển trạng thái sai trả `409 Conflict`.
- **Open Item (`OrderStatusHistory.fromStatus`):**
  - Trong `schema.prisma`, `fromStatus OrderStatus` là non-nullable. Khi tạo đơn ban đầu, `fromStatus` là null.
  - **Đề xuất giải pháp:** Backend owner sẽ tạo một migration riêng sửa thành `fromStatus OrderStatus?` (nullable) khi triển khai code. Không sửa schema ở giai đoạn tài liệu hóa hợp đồng.

---

## 6. Lịch sử thay đổi
- v1.0 (2026-10-13): Khởi tạo tài liệu API Contract Order.
- v1.1 – áp dụng quyết định D1, D3, D4, D5, D6, D7 (ngày 2026-10-16).
