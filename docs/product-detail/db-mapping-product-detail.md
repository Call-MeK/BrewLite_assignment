# BrewLite — DB Mapping: Chi tiết sản phẩm

**Trạng thái:** Chuẩn hóa theo quyết định của Nhóm trưởng  
**Người phụ trách:** Product Detail (Vũ Hoàng Huy)  
**Giai đoạn:** Architecture Mapping  
**Cập nhật lần cuối:** 13/10/2026  

---

## 1. Mục đích

Tài liệu này mô tả cách ánh xạ dữ liệu giữa PostgreSQL, Prisma và API của tính năng Product Detail dựa trên file `schema.prisma` hiện tại của dự án BrewLite.

Mục tiêu là xác định dữ liệu Backend có thể lấy để hiển thị chi tiết sản phẩm, kích cỡ (`sizePrices`), topping và giá tiền mà không tạo thêm cấu trúc trùng với schema hiện có.

Phạm vi chính:

* `Product`: thông tin sản phẩm.
* `ProductSizePrice`: kích cỡ và phụ phí của sản phẩm (`sizePrices`).
* `Topping`: thông tin topping.
* `Category`: danh mục sản phẩm.
* Các model liên quan đến đơn hàng để làm rõ cách lưu lựa chọn sản phẩm.

**Lưu ý:** Đây là tài liệu ánh xạ dữ liệu, không phải yêu cầu thay đổi `schema.prisma`.

---

## 2. Quy ước đặt tên

Áp dụng `naming-convention.md` của nhóm:

* Tên model Prisma: `PascalCase`, số ít.
* Tên bảng PostgreSQL: `snake_case`, số nhiều.
* Tên trường trong Prisma: `camelCase`.
* Tên cột được ánh xạ bằng `@map()` nếu cần dùng `snake_case`.
* Khóa chính có tên `id`, kiểu `String`, mặc định sử dụng `cuid()` trong schema hiện tại.
* Khóa ngoại dùng tên theo quy tắc `<tên_thực_thể>Id`.

---

## 3. Ánh xạ model hiện có

### 3.1. Product — Sản phẩm

**Prisma Model:** `Product`  
**Bảng PostgreSQL:** `products`  

| Trường Prisma | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String` | Mã sản phẩm, dùng CUID |
| `categoryId` | `String?` | Mã danh mục, có thể không có |
| `name` | `String` | Tên sản phẩm |
| `basePrice` | `Decimal(12,0)` | Giá gốc tính bằng VND |
| `imageUrl` | `String?` | Đường dẫn hình ảnh, có thể không có |
| `stock` | `Int` | Số lượng tồn kho, mặc định `0` (dùng kiểm tra nội bộ) |
| `version` | `Int` | Phiên bản phục vụ Optimistic Locking, mặc định `0` |
| `isAvailable` | `Boolean` | Trạng thái bán, mặc định `true` |
| `createdAt` | `DateTime` | Thời điểm tạo |
| `updatedAt` | `DateTime` | Thời điểm cập nhật |

**Quan hệ hiện có:**

* `Product` có thể thuộc một `Category`.
* `Product` có nhiều bản ghi `ProductSizePrice`.
* `Product` có thể xuất hiện trong nhiều `OrderItem`.

**Quy tắc nghiệp vụ trạng thái bán & tồn kho (Quyết định 5 của Nhóm trưởng):**
Trường `isAvailable` trong API response được Backend tính toán theo công thức:
`isAvailable = (Product.isAvailable === true && Product.stock > 0)`
Tuyệt đối **không trả trường `stock`** ra ngoài API. Nếu `isAvailable === false` (hết hàng hoặc ngừng bán), sản phẩm vẫn được trả về để Frontend hiển thị nhãn "Hết hàng" và khóa thao tác thêm vào giỏ hàng.

---

### 3.2. ProductSizePrice — Giá theo kích cỡ (`sizePrices`)

**Prisma Model:** `ProductSizePrice`  
**Bảng PostgreSQL:** `product_size_prices`  

| Trường Prisma | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String` | Mã bản ghi giá kích cỡ |
| `productId` | `String` | Mã sản phẩm |
| `size` | `ProductSize` | Kích cỡ `S`, `M` hoặc `L` |
| `priceAdjustment` | `Decimal(12,0)` | Phụ phí kích cỡ, mặc định `0` |

Model `ProductSizePrice` liên kết với `Product` thông qua `productId`.
Ràng buộc `@@unique([productId, size])` bảo đảm mỗi sản phẩm không có hai bản ghi giá cho cùng một kích cỡ.

| Giá trị enum | Ý nghĩa |
| :--- | :--- |
| `S` | Nhỏ (phụ thu `0đ`) |
| `M` | Vừa (phụ thu `5.000đ`) |
| `L` | Lớn (phụ thu `10.000đ`) |

**Quy tắc giá:** `unitPrice = basePrice + priceAdjustment(size) + Σ giá topping`.

---

### 3.3. Topping — Topping thêm vào đồ uống

**Prisma Model:** `Topping`  
**Bảng PostgreSQL:** `toppings`  

| Trường Prisma | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String` | Mã topping |
| `name` | `String` | Tên topping, không trùng lặp |
| `price` | `Decimal(12,0)` | Giá topping tính bằng VND |
| `stock` | `Int` | Tồn kho, mặc định `100` |
| `isAvailable` | `Boolean` | Trạng thái cung cấp, mặc định `true` |

> **Lưu ý kỹ thuật về trừ kho (Quyết định D3):** `Topping` KHÔNG có cột `version` như `Product`. Do đó khi trừ tồn kho topping trong transaction đặt hàng, backend sử dụng cập nhật có điều kiện `updateMany({ where: { id: toppingId, stock: { gte: qty } }, data: { stock: { decrement: qty } } })`. Nếu số dòng cập nhật = 0 -> ném `400 Bad Request` ("Topping đã hết hàng").

---

### 3.4. Category — Danh mục sản phẩm

**Prisma Model:** `Category`  
**Bảng PostgreSQL:** `categories`  

| Trường Prisma | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `id` | `String` | Mã danh mục |
| `name` | `String` | Tên danh mục, không trùng lặp |
| `slug` | `String` | Đường dẫn định danh |
| `displayOrder` | `Int` | Thứ tự hiển thị |

---

## 4. Ánh xạ Database sang API Product Detail

**Endpoint:** `GET /api/v1/products/:id`

| Trường API | Nguồn dữ liệu hiện tại | Ghi chú & Quyết định |
| :--- | :--- | :--- |
| `data.id` | `Product.id` | Mã sản phẩm (CUID) |
| `data.name` | `Product.name` | Tên sản phẩm |
| `data.imageUrl` | `Product.imageUrl` | Có thể là `null` |
| `data.basePrice` | `Product.basePrice` | Giá gốc (convert sang Number) |
| `data.currency` | Quy ước API | Giá trị `"VND"` |
| `data.isAvailable` | `Product.isAvailable && Product.stock > 0` | **Quyết định 1 & 5:** Dùng `isAvailable`, không trả `stock` |
| `data.sizePrices[]` | `Product.sizePrices` | **Quyết định 1:** Dùng `sizePrices` thay cho `sizes` |
| `data.sizePrices[].size` | `ProductSizePrice.size` | Giá trị `'S'`, `'M'`, `'L'` |
| `data.sizePrices[].priceAdjustment` | `ProductSizePrice.priceAdjustment` | Phụ phí kích cỡ |
| `data.toppings[]` | `Topping (isAvailable && stock > 0)` | **Quyết định D3:** Không dùng bảng trung gian `ProductTopping`. Trả về toàn bộ Topping khả dụng gồm `id`, `name`, `price` (convert `Decimal` sang `Number`). Không trả `stock` ra ngoài API. |

---

## 5. Quy tắc tính giá

Theo API Contract của Product Detail:

```
unitPrice = basePrice + priceAdjustment + tổng giá topping được chọn
Thành tiền = unitPrice × quantity
```

* `basePrice` lấy từ `Product.basePrice`.
* `priceAdjustment` lấy từ `sizePrices[].priceAdjustment` ứng với kích cỡ được chọn.
* Backend xác thực các lựa chọn trước khi tạo đơn; không tin cậy giá từ Client.

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D3 (ngày 2026-10-16).*