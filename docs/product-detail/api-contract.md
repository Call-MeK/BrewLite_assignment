# BrewLite — Tài liệu hợp đồng API: Chi tiết sản phẩm

**Trạng thái:** Chuẩn hóa theo quyết định của Nhóm trưởng  
**Người phụ trách:** Product Detail (Vũ Hoàng Huy)  
**Giai đoạn:** Architecture Mapping  
**Cập nhật lần cuối:** 13/10/2026  

---

## 1. Mục đích

Tài liệu này mô tả hợp đồng API dùng để lấy thông tin chi tiết một sản phẩm trong hệ thống BrewLite.

API cung cấp dữ liệu để Frontend hiển thị trang chi tiết sản phẩm, bao gồm tên, hình ảnh, giá gốc, trạng thái khả dụng (`isAvailable`), danh sách kích cỡ phụ thu (`sizePrices`) và topping.

Backend chịu trách nhiệm xác định giá chính thức. Frontend có thể tính giá ước tính để hiển thị khi người dùng thay đổi lựa chọn.

**Lưu ý:** Cấu trúc API đã được thống nhất 100% với `schema.prisma`, `backend/prisma/seed.ts` và tài liệu `db-mapping-product-detail.md`.

---

## 2. Thông tin API

| Thuộc tính    | Giá trị                             |
| ------------- | ----------------------------------- |
| Phương thức   | `GET`                               |
| Endpoint      | `/api/v1/products/:id`              |
| Chức năng     | Lấy thông tin chi tiết một sản phẩm |
| Mã thành công | `200 OK`                            |
| Xác thực      | Không yêu cầu (Public API)          |
| Kiểu dữ liệu  | `application/json`                  |

### Tham số đường dẫn

| Tham số | Kiểu dữ liệu | Bắt buộc | Ý nghĩa                            |
| ------- | ------------ | -------- | ---------------------------------- |
| `id`    | `string`     | Có       | Mã định danh duy nhất của sản phẩm |

Theo `schema.prisma`, ID của sản phẩm được tạo bằng CUID thông qua `@default(cuid())`.

---

## 3. Phản hồi khi thành công

Tất cả phản hồi thành công tuân theo định dạng chung trong `checklist-review.md` qua `TransformInterceptor`.

**HTTP Status:** `200 OK`

Ví dụ phản hồi chuẩn:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "cmv19kpye000794rc6vgebmpz",
    "name": "Cà phê sữa đá",
    "imageUrl": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600",
    "basePrice": 35000,
    "currency": "VND",
    "isAvailable": true,
    "sizePrices": [
      {
        "size": "S",
        "priceAdjustment": 0
      },
      {
        "size": "M",
        "priceAdjustment": 5000
      },
      {
        "size": "L",
        "priceAdjustment": 10000
      }
    ],
    "toppings": [
      {
        "id": "cmv19top000194rc6vgebmp1",
        "name": "Trân châu trắng",
        "price": 5000
      },
      {
        "id": "cmv19top000294rc6vgebmp2",
        "name": "Kem Cheese",
        "price": 10000
      },
      {
        "id": "cmv19top000394rc6vgebmp3",
        "name": "Đào miếng",
        "price": 8000
      }
    ]
  },
  "timestamp": "2026-10-13T08:39:03.235Z"
}
```

### Giải thích các trường

* `success`: Cho biết yêu cầu có thành công hay không (`true`).
* `statusCode`: Mã trạng thái HTTP (`200`).
* `data`: Dữ liệu chi tiết sản phẩm.
  * `id`: Mã sản phẩm, lưu trong `Product.id`.
  * `name`: Tên sản phẩm, lưu trong `Product.name`.
  * `imageUrl`: Đường dẫn hình ảnh, lưu trong `Product.imageUrl`; có thể là `null` nếu chưa có ảnh.
  * `basePrice`: Giá gốc (VND nguyên chẵn), lấy từ `Product.basePrice`.
  * `currency`: Đơn vị tiền tệ theo quy ước API, hiện là `VND`.
  * `isAvailable`: Trạng thái mở bán (Quyết định 1 & 5). Backend tính toán: `Product.isAvailable && Product.stock > 0`. Nếu hết hàng thì trường này trả `false` để FE hiển thị badge "Hết hàng" và khóa thao tác thêm giỏ.
  * `sizePrices`: Danh sách kích cỡ và phụ phí tương ứng, lấy từ bảng `ProductSizePrice` (Quyết định 1).
    * `size`: Kích cỡ đồ uống theo enum `ProductSize` (`'S'`, `'M'`, `'L'`).
    * `priceAdjustment`: Mức giá phụ thu kích cỡ (VND: `0`, `5000`, `10000`).
  * `toppings`: Danh sách topping khả dụng cho sản phẩm (Quyết định D3). Hệ thống không dùng bảng liên kết `ProductTopping` mà trả về toàn bộ `Topping` có `isAvailable = true` và `stock > 0`. Mỗi phần tử gồm `id` (chuỗi CUID), `name` (tên topping), `price` (số nguyên VND). Không trả trường `stock` ra ngoài API.
* `timestamp`: Thời điểm tạo phản hồi theo ISO-8601.

> **Ghi chú về `stock` (Quyết định 5 của Nhóm trưởng):** Không trả trường `stock` ra ngoài API để bảo mật dữ liệu kho. Tính khả dụng được thể hiện trọn vẹn qua trường `isAvailable`.

---

## 4. Phản hồi khi xảy ra lỗi

Tất cả phản hồi lỗi tuân theo định dạng `AllExceptionsFilter` trong `checklist-review.md`.

### 4.1. Không tìm thấy sản phẩm

**HTTP Status:** `404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Không tìm thấy sản phẩm với ID cung cấp",
  "timestamp": "2026-10-13T08:39:03.235Z",
  "path": "/api/v1/products/clproduct001"
}
```

### 4.2. ID sản phẩm không hợp lệ

* `400 Bad Request` nếu ID sai định dạng.
* `404 Not Found` nếu ID đúng định dạng nhưng không có trong CSDL.

### 4.3. Lỗi hệ thống

**HTTP Status:** `500 Internal Server Error`

```json
{
  "success": false,
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Đã xảy ra lỗi không mong muốn phía máy chủ",
  "timestamp": "2026-10-13T08:39:03.235Z",
  "path": "/api/v1/products/clproduct001"
}
```

---

## 5. Quy tắc nghiệp vụ

1. **Nguồn xác định giá:** Backend là nguồn duy nhất xác định giá chính thức.
2. **Công thức tính giá:**
   ```
   unitPrice = basePrice + priceAdjustment(size) + Σ giá topping
   ```
3. **Phụ phí size:** Lấy từ phần tử tương ứng trong `sizePrices[]`.
4. **Trạng thái bán (Quyết định 5):** Dùng trường `isAvailable`. Backend trả `isAvailable = (Product.isAvailable && stock > 0)`. Nếu `isAvailable === false`, sản phẩm vẫn được trả về để Frontend hiển thị nhãn "Hết hàng" và vô hiệu hóa nút "Thêm vào giỏ hàng".
5. **Số lượng:** Số lượng đặt phải từ 1 đến 99 mỗi món.
6. **Bảo mật giá:** Backend tính toán lại toàn bộ đơn giá và thành tiền khi tạo đơn hàng, tuyệt đối không tin cậy giá gửi từ Frontend.

---

## 6. Ánh xạ dữ liệu API với database

| Trường API | Nguồn dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | `Product.id` | ID dạng CUID |
| `name` | `Product.name` | Tên sản phẩm |
| `imageUrl` | `Product.imageUrl` | Có thể là `null` |
| `basePrice` | `Product.basePrice` | Kiểu Decimal trong Prisma, trả về number nguyên |
| `currency` | Quy ước API | Giá trị `"VND"` |
| `isAvailable` | `Product.isAvailable && Product.stock > 0` | Quyết định 1 & 5 của Nhóm trưởng |
| `sizePrices` | `ProductSizePrice` | Lấy danh sách kích cỡ theo sản phẩm (Quyết định 1) |
| `sizePrices[].size` | `ProductSizePrice.size` | Enum gồm `'S'`, `'M'`, `'L'` |
| `sizePrices[].priceAdjustment` | `ProductSizePrice.priceAdjustment` | Phụ phí kích cỡ |
| `toppings` | `Topping` | Toàn bộ `Topping` có `isAvailable = true` và `stock > 0` (Quyết định D3) |
| `description` | Chưa có nguồn dữ liệu | Model `Product` hiện chưa có trường này |

---

## 7. Tích hợp với Frontend

Frontend có trách nhiệm:
* Gọi `GET /api/v1/products/:id` để lấy chi tiết sản phẩm.
* Hiển thị tên, hình ảnh, giá gốc, kích cỡ (`sizePrices`), topping và trạng thái khả dụng (`isAvailable`).
* Hiển thị trạng thái đang tải dữ liệu (`loading`) và trạng thái lỗi (`error`).
* Khi `isAvailable === false`: Hiển thị huy hiệu "Hết hàng" và khóa thao tác thêm vào giỏ.
* Tính giá ước tính khi người dùng thay đổi kích cỡ hoặc topping.
* Xử lý trường `imageUrl` có giá trị `null` bằng ảnh placeholder.

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D3, D5 (ngày 2026-10-16).*