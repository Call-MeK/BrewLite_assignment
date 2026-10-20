# 📜 API CONTRACT: CART VALIDATION & CHECKOUT

Mặc dù Giỏ hàng được quản lý dưới dạng Local State tại client (Zustand) và không có API CRUD riêng cho giỏ hàng, thao tác quan trọng nhất của phân hệ này là chuẩn bị Request Payload chuẩn xác để giao tiếp với API tạo đơn hàng `POST /api/v1/orders`. 

Tài liệu này là "Hợp đồng giao tiếp" chính thức giữa Cart (Frontend) và Orders Module (Backend).

---

## 1. Endpoint giao tiếp chính
* **Method:** `POST`
* **URL:** `/api/v1/orders`
* **Authorization:** `Bearer <JWT_TOKEN>` (Bắt buộc Khách hàng phải đăng nhập)
* **Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer eyJhbGciOi...`
* **Nhiệm vụ:** Nhận dữ liệu giỏ hàng, xác thực người dùng, kiểm tra hợp lệ DTO (ValidationPipe), kiểm tra tồn kho & đơn giá trong CSDL, và khởi tạo đơn hàng mới với trạng thái `PENDING`.

---

## 2. Request Payload (Giỏ hàng gửi xuống)
Được tổng hợp từ danh sách `items` trong `useCartStore` của Frontend trước khi gửi đi:

```json
{
  "items": [
    {
      "productId": "clx_product_caphe_sua_001",
      "size": "M",
      "toppingIds": [
        "clx_topping_tranchau_den_01",
        "clx_topping_thach_cafe_02"
      ],
      "quantity": 2
    },
    {
      "productId": "clx_product_tra_dao_002",
      "size": "L",
      "toppingIds": [],
      "quantity": 1
    }
  ],
  "promotionCode": "BREWNEW10"
}
```

> [!IMPORTANT]
> **Lưu ý kỹ thuật về DTO (`forbidNonWhitelisted` - Quyết định D7):**
> Do NestJS áp dụng `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, backend `CreateOrderDto` bắt buộc phải khai báo trường `promotionCode?: string` (@IsOptional @IsString). Nếu không khai báo trong DTO, toàn bộ request gửi kèm mã khuyến mãi từ giỏ hàng sẽ bị từ chối với lỗi `400 Bad Request` ("property promotionCode should not exist").

---

## 3. Cấu trúc Response (Tuân thủ chuẩn TransformInterceptor & AllExceptionsFilter)

### 3.1. Kịch bản Thành công (Tạo đơn thành công)
* **Status Code:** `201 Created`
* **Mô tả:** Backend lưu đơn thành công vào cơ sở dữ liệu, trả về mã `id` (mã đơn hàng) và `orderNumber`. Frontend **KHÔNG** làm rỗng giỏ hàng tại bước này mà lưu `pendingOrderId` vào `useCartStore` (giữ nguyên các món trong giỏ hàng - Quyết định D2) và điều hướng sang màn hình Thanh toán. Chỉ gọi `clearCart()` và xóa `pendingOrderId` khi đơn hàng thanh toán thành công (`PAID`).

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "clx_order_998877",
    "orderNumber": 1042,
    "status": "PENDING",
    "totalAmount": 125000,
    "discountAmount": 10000,
    "finalAmount": 115000
  },
  "timestamp": "2026-10-12T13:45:00.000Z"
}
```

### 3.2. Kịch bản Lỗi Validation DTO (Dữ liệu đầu vào sai định dạng)
* **Status Code:** `400 Bad Request`
* **Mô tả:** Dữ liệu Frontend gửi lên không hợp lệ (số lượng `< 1` hoặc `> 99` theo Quyết định D5, thiếu `productId`, sai enum `size`, hoặc giỏ hàng rỗng). Bị chặn ngay tại `ValidationPipe` cấp Controller, chưa truy vấn CSDL.

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "Số lượng mỗi món phải lớn hơn hoặc bằng 1",
    "Số lượng mỗi món không được vượt quá 99",
    "Kích cỡ món (size) bắt buộc phải là một trong các giá trị: S, M, L",
    "Mỗi món chỉ được chọn tối đa 3 loại topping",
    "Danh sách topping không được chứa ID trùng lặp"
  ],
  "timestamp": "2026-10-12T13:45:00.000Z",
  "path": "/api/v1/orders"
}
```

### 3.3. Kịch bản Lỗi Nghiệp vụ Database (Hết hàng / Lệch giá)
* **Status Code:** `400 Bad Request`
* **Mô tả:** Dữ liệu đúng định dạng DTO, nhưng khi Backend đối chiếu CSDL phát hiện sản phẩm đã ngưng bán (`isAvailable: false`), không đủ số lượng tồn kho (`stock < quantity`), hoặc giá sản phẩm đã thay đổi.

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Sản phẩm Cà phê sữa đá (Size M) hiện không đủ số lượng tồn kho.",
  "timestamp": "2026-10-12T13:45:00.000Z",
  "path": "/api/v1/orders"
}
```

### 3.4. Kịch bản Chưa đăng nhập hoặc Token hết hạn
* **Status Code:** `401 Unauthorized`
* **Mô tả:** Khách hàng chưa đăng nhập hoặc Token JWT đã hết hạn khi gửi yêu cầu tạo đơn.

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Vui lòng đăng nhập để tiến hành đặt hàng",
  "timestamp": "2026-10-12T13:45:00.000Z",
  "path": "/api/v1/orders"
}
```
* **Frontend Handling:** Frontend giữ nguyên trạng thái giỏ hàng trong LocalStorage, hiển thị Toast cảnh báo và điều hướng người dùng tới trang Đăng nhập (`/auth/login?redirect=/cart`).

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D2, D5, D7 (ngày 2026-10-16).*