# 🗄️ DATABASE MAPPING: ORDER MODULE

> **Feature:** Order (Quản lý và tạo đơn hàng)  
> **Tác giả:** Vo Thi Thuy  
> **Phiên bản:** v1.0 (Kiến trúc Tuần 1)  
> **Mục tiêu:** Ánh xạ chi tiết từ API Request / Business Logic sang các bảng vật lý PostgreSQL và Prisma Models trong `backend/prisma/schema.prisma`.

---

## 1. TỔNG QUAN CÁC THỰC THỂ LIÊN QUAN

Module Order tương tác trực tiếp với 4 bảng dữ liệu cốt lõi trong cơ sở dữ liệu:
1. `orders`: Lưu trữ thông tin đơn hàng tổng quát, trạng thái và giá trị thanh toán.
2. `order_items`: Lưu từng dòng món hàng trong đơn (kèm size, số lượng, đơn giá chốt tại thời điểm đặt).
3. `order_item_toppings`: Lưu các topping kèm theo từng dòng món (kèm đơn giá topping chốt tại thời điểm đặt).
4. `order_status_histories`: Truy vết nhật ký thay đổi trạng thái theo State Machine.

Đồng thời cập nhật tồn kho có điều kiện trên bảng:
- `products`: Giảm `stock` và tăng `version` (phục vụ concurrency control).
- `toppings`: Giảm `stock`.

---

## 2. BẢNG MAPPING CHI TIẾT

### 2.1. Bảng `orders` (Prisma Model: `Order`)

| Thuộc tính API / Nguồn | Prisma Field | Cột Database | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- | :--- | :--- |
| Hệ thống sinh | `id` | `id` | `String` (cuid) | Primary Key |
| DB sinh tự động | `orderNumber` | `order_number` | `Int` (autoincrement) | Unique. Mã hiển thị (ví dụ `#1042`) |
| `req.user.sub` (JWT) | `userId` | `user_id` | `String` | Foreign Key -> `users.id` |
| Request `promoCode` (nếu có) | `promotionId` | `promotion_id` | `String?` | Foreign Key -> `promotions.id` |
| Hệ thống gán ban đầu | `status` | `status` | `OrderStatus` | Mặc định `PENDING` khi mới tạo |
| Server tính toán | `totalAmount` | `total_amount` | `Decimal(12, 0)` | Tổng tiền hàng trước giảm giá |
| Server tính toán | `discountAmount` | `discount_amount` | `Decimal(12, 0)` | Số tiền được giảm (mặc định `0`) |
| Server tính toán | `finalAmount` | `final_amount` | `Decimal(12, 0)` | Tiền thực tế phải trả (= total - discount) |
| Server tính toán | `pointsEarned` | `points_earned` | `Int` | Điểm loyalty tích được (tính khi PAID) |
| Thanh toán thành công | `paidAt` | `paid_at` | `DateTime?` | Thời điểm thanh toán thành công |
| Khởi tạo ban đầu | `version` | `version` | `Int` | Mặc định `0` (Optimistic locking) |
| DB gán tự động | `createdAt` | `created_at` | `DateTime` | Thời gian tạo đơn |
| DB cập nhật | `updatedAt` | `updated_at` | `DateTime` | Thời gian cập nhật gần nhất |

### 2.2. Bảng `order_items` (Prisma Model: `OrderItem`)

| Thuộc tính API / Nguồn | Prisma Field | Cột Database | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- | :--- | :--- |
| Hệ thống sinh | `id` | `id` | `String` (cuid) | Primary Key |
| `Order.id` vừa tạo | `orderId` | `order_id` | `String` | Foreign Key -> `orders.id` (onDelete: Cascade) |
| `items[].productId` | `productId` | `product_id` | `String` | Foreign Key -> `products.id` |
| `items[].size` | `size` | `size` | `ProductSize` | Enum `S`, `M`, `L` (mặc định `M`) |
| `items[].quantity` | `quantity` | `quantity` | `Int` | Số lượng đặt (1..99) (D5) |
| `Product.basePrice + sizePrice` | `unitPrice` | `unit_price` | `Decimal(12, 0)` | Đơn giá sản phẩm theo size tại thời điểm đặt |
| `(unitPrice + toppings) * qty` | `lineTotal` | `line_total` | `Decimal(12, 0)` | Thành tiền của dòng món |

### 2.3. Bảng `order_item_toppings` (Prisma Model: `OrderItemTopping`)

| Thuộc tính API / Nguồn | Prisma Field | Cột Database | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- | :--- | :--- |
| Hệ thống sinh | `id` | `id` | `String` (cuid) | Primary Key |
| `OrderItem.id` vừa tạo | `orderItemId` | `order_item_id` | `String` | Foreign Key -> `order_items.id` (Cascade) |
| `items[].toppingIds[]` | `toppingId` | `topping_id` | `String` | Foreign Key -> `toppings.id` |
| `Topping.price` | `price` | `price` | `Decimal(12, 0)` | Đơn giá topping tại thời điểm đặt |

### 2.4. Bảng `order_status_histories` (Prisma Model: `OrderStatusHistory`)

| Thuộc tính API / Nguồn | Prisma Field | Cột Database | Kiểu dữ liệu | Ràng buộc / Ý nghĩa |
| :--- | :--- | :--- | :--- | :--- |
| Hệ thống sinh | `id` | `id` | `String` (cuid) | Primary Key |
| `Order.id` | `orderId` | `order_id` | `String` | Foreign Key -> `orders.id` |
| Trạng thái trước | `fromStatus` | `from_status` | `OrderStatus` | Trạng thái trước đó (Xem Open Item bên dưới) |
| Trạng thái sau | `toStatus` | `to_status` | `OrderStatus` | `PENDING`, `PAID`, `CANCELLED`, v.v. |
| Tác nhân thay đổi | `changedBy` | `changed_by` | `String?` | `system`, `customer`, `barista` |
| Lý do | `reason` | `reason` | `String?` | Ví dụ: "Order created", "Payment success", "Customer cancelled" |
| Thời điểm ghi nhận | `createdAt` | `created_at` | `DateTime` | Timestamp sự kiện |

---

## 3. CÔNG THỨC TÍNH GIÁ & TRANSACTION BOUNDARY

1. **Công thức tính dòng sản phẩm (`lineTotal`):**
   $$\text{unitPrice} = \text{Product.basePrice} + \text{ProductSizePrice.priceAdjustment(size)}$$
   $$\text{toppingsTotal} = \sum \text{Topping.price}$$
   $$\text{lineTotal} = (\text{unitPrice} + \text{toppingsTotal}) \times \text{quantity}$$

2. **Công thức tính tổng đơn hàng (`totalAmount` & `finalAmount`):**
   $$\text{totalAmount} = \sum \text{lineTotal}$$
   $$\text{finalAmount} = \max(0, \text{totalAmount} - \text{discountAmount})$$

3. **Transaction Boundary (Prisma `$transaction`):**
   - **Tạo đơn hàng:**
     + Trừ tồn kho `Product.stock` bằng Optimistic Locking (`version: currentVersion, stock: { gte: quantity }`).
     + Trừ tồn kho `Topping.stock` có điều kiện (`stock: { gte: item.quantity }`).
     + `Order.create` kèm các dòng `OrderItem`, `OrderItemTopping` và bản ghi khởi tạo `OrderStatusHistory`.
     + Rollback toàn bộ nếu bất kỳ bước nào thất bại.
   - **Hủy đơn hàng (`POST /orders/:id/cancel` - D6):**
     + Chỉ cho phép khi đơn ở `PENDING` hoặc `PAYMENT_FAILED`.
     + Hoàn tồn kho `Product.stock` (+quantity, +1 version) và `Topping.stock` (+1) trong cùng transaction.
     + Cập nhật `Order.status = CANCELLED` và tạo `OrderStatusHistory`.
   - **Cộng điểm thưởng Loyalty (D9):**
     + Khi chuyển đơn sang `PAID`: tính `points = Math.floor(finalAmount / 1000)`.
     + Cập nhật `Order.pointsEarned`, tăng `User.loyaltyPoints` và tạo bản ghi `LoyaltyTransaction` loại `EARNED` trong cùng transaction với transition sang `PAID`.

---

## 4. Điểm cần xử lý (Open Item)

- **Lệch schema tại `OrderStatusHistory.fromStatus`:**
  - Trong `schema.prisma`, trường `fromStatus OrderStatus` là bắt buộc (không nullable).
  - Tuy nhiên, khi tạo đơn hàng mới (`(start) → PENDING`), trạng thái ban đầu chưa có trạng thái trước (`fromStatus: null`).
  - **Đề xuất giải pháp:** Giữ nguyên schema hiện tại trong tài liệu này; Backend Owner sẽ tạo một migration riêng để sửa trường này thành nullable (`fromStatus OrderStatus?`). Không sửa schema trong nhánh tài liệu.

## 5. Lịch sử thay đổi
- v1.0 (2026-10-10): Khởi tạo tài liệu DB Mapping Order.
- v1.1 – áp dụng quyết định D1, D3, D5, D6, D7, D9 (ngày 2026-10-16).

