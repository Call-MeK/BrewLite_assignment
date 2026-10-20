# 🗄️ DB MAPPING: CART STATE TO ORDER ENTITIES

**Phân hệ:** Cart (Giỏ hàng)  
**Kiến trúc:** Giỏ hàng duy trì dưới dạng Client-side Local State (Zustand + LocalStorage), không tạo bảng `Cart` riêng trong PostgreSQL để tối ưu hiệu năng. Bảng này mô tả chi tiết cách thức ánh xạ dữ liệu từ `CartState` (Frontend) sang các bảng `Order`, `OrderItem`, và `OrderItemTopping` trong Database khi gọi API tạo đơn (`POST /api/v1/orders`).

---

## 1. Ánh xạ dữ liệu Giỏ hàng tổng (Cart) -> Bảng `Order`

| Trường ở Giỏ hàng (Frontend) | Ánh xạ vào Bảng `Order` (Database) | Kiểu dữ liệu (Prisma / DB) | Ghi chú / Quy tắc nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `totalAmount` | `totalAmount` | `Decimal(12, 0)` | **Tạm tính trước giảm:** Backend tự động tính lại từ DB (`sum(lineTotal)`), không tin tưởng số tiền gửi từ FE. |
| (Mã voucher nếu có) | `discountAmount`, `promotionId` | `Decimal(12, 0)`, `String` (FK -> `Promotion.id`) | Số tiền được giảm trừ (mặc định là `0`) và khóa ngoại liên kết tới `Promotion` nếu áp dụng mã hợp lệ (Quyết định D7). |
| (Không có) | `finalAmount` | `Decimal(12, 0)` | **Số tiền thực trả:** Backend tính toán `finalAmount = totalAmount - discountAmount`. |
| (Không có) | `status` | `OrderStatus` (Enum) | Mặc định khởi tạo là `PENDING` khi vừa tạo đơn thành công từ giỏ hàng. |
| (Không có) | `userId` | `String` (FK -> `User.id`) | Backend trích xuất tự động từ JWT Token của khách hàng (`req.user.sub`) qua `JwtAuthGuard` (Quyết định D4). |
| (Không có) | `orderNumber` | `Int` (Autoincrement) | Database tự động tăng sinh mã số hiển thị thân thiện (ví dụ: `#1001`). |

---

## 2. Ánh xạ từng dòng món trong giỏ (CartItem) -> Bảng `OrderItem`

| Trường `CartItem` (Frontend) | Ánh xạ vào Bảng `OrderItem` (Database) | Kiểu dữ liệu (Prisma / DB) | Ghi chú / Quy tắc nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` / `cartItemId` | *(Không lưu)* | `String` (Client-only) | Khóa định danh cục bộ tại client để quản lý tăng/giảm số lượng và xóa món không trùng lặp. |
| `productId` | `productId` | `String` (FK -> `Product.id`) | Khóa ngoại liên kết tới sản phẩm đồ uống trong menu. |
| `size` ('S', 'M', 'L') | `size` | `ProductSize` (Enum) | Kích cỡ món (`S`, `M`, `L`). |
| `quantity` | `quantity` | `Int` | **Số lượng ly:** Bắt buộc số nguyên từ 1 đến 99 (`1 <= quantity <= 99` theo Quyết định D5). Schema Prisma dùng `quantity`, không phải `qty`. |
| (Backend tính toán) | `unitPrice` | `Decimal(12, 0)` | **Đơn giá 1 ly (kèm size):** `Product.basePrice + ProductSizePrice.priceAdjustment`. |
| (Backend tính toán) | `lineTotal` | `Decimal(12, 0)` | **Tổng tiền dòng:** `(unitPrice + sum(Topping.price)) * quantity`. |

---

## 3. Ánh xạ Topping đi kèm -> Bảng `OrderItemTopping`

| Trường `CartItem` (Frontend) | Ánh xạ vào Bảng `OrderItemTopping` (Database) | Kiểu dữ liệu (Prisma / DB) | Ghi chú / Quy tắc nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `toppingIds[i]` | `toppingId` | `String` (FK -> `Topping.id`) | Khóa ngoại liên kết tới bảng `Topping`. Mỗi ID sẽ tạo thành 1 dòng liên kết với `orderItemId`. |
| (Backend truy vấn) | `price` | `Decimal(12, 0)` | Giá bán của từng topping được chốt tại thời điểm đặt hàng (lấy từ `Topping.price`). |

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D4, D5, D7 (ngày 2026-10-16).*