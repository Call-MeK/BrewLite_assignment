# 📜 API CONTRACT – PRODUCT CATALOG (MENU SẢN PHẨM)

**Phân hệ:** Product Catalog (CAT)  
**Tác giả:**  (Owner Feature: Product Catalog)  
**Phiên bản:** 1.1 — Chuẩn hóa theo quyết định của Nhóm trưởng  
**Ngày cập nhật:** 13/10/2026  

---

## 1. TỔNG QUAN

API cung cấp danh sách toàn bộ sản phẩm đồ uống đang mở bán và còn hàng để Frontend hiển thị trên trang Thực đơn (`/menu`).

* **Phương thức (HTTP Method):** `GET`
* **Đường dẫn (Endpoint):** `/api/v1/products`
* **Mã thành công:** `200 OK`
* **Xác thực (Authentication):** Không yêu cầu (Public API).
* **Quy tắc lọc dữ liệu phía Server:**
  * Backend lọc theo điều kiện: `Product.isAvailable === true` VÀ `Product.stock > 0`.
  * Sắp xếp mặc định: Tên sản phẩm tăng dần (`name ASC`).
  * **Bảo mật kinh doanh:** Tuyệt đối **không trả trường `stock`** ra ngoài API. Cờ `isAvailable` trả về `true` cho các sản phẩm còn hàng đủ điều kiện mở bán.
* **Xử lý phía Client (Frontend):**
  * Toàn bộ thao tác tìm kiếm theo tên (không phân biệt hoa/thường, không phân biệt dấu tiếng Việt) và lọc theo danh mục đều thực hiện tại Frontend trên danh sách đã tải về.
  * Không gửi query parameters (`?search=...`, `?category=...`) lên Backend trong phiên bản MVP.

---

## 2. YÊU CẦU (REQUEST SPECIFICATION)

### 2.1. HTTP Request
* **URL:** `http://localhost:4000/api/v1/products`
* **Headers:**
  ```http
  Accept: application/json
  ```
* **Request Body:** Không có.
* **Query Parameters:** Không có.

---

## 3. PHẢN HỒI THÀNH CÔNG (SUCCESS RESPONSE)

* **HTTP Status Code:** `200 OK`
* **Định dạng bao đóng:** Bọc qua `TransformInterceptor` theo quy chuẩn `checklist-review.md`.

### 3.1. Phản hồi mẫu (Sample JSON Response)

Dữ liệu mẫu chuẩn hóa 100% theo `backend/prisma/seed.ts` và `backend/prisma/schema.prisma`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "cmv19kpze000c94rcbvzmlrfz",
      "name": "Americano",
      "basePrice": 40000,
      "imageUrl": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600",
      "isAvailable": true,
      "categoryName": "Cà phê",
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
      ]
    },
    {
      "id": "cmv19kpzp000h94rc3af9h2y8",
      "name": "Cappuccino",
      "basePrice": 45000,
      "imageUrl": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600",
      "isAvailable": true,
      "categoryName": "Cà phê",
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
      ]
    },
    {
      "id": "cmv19kpye000794rc6vgebmpz",
      "name": "Cà phê sữa đá",
      "basePrice": 35000,
      "imageUrl": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600",
      "isAvailable": true,
      "categoryName": "Cà phê",
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
      ]
    },
    {
      "id": "cmv19kpzz000m94rcy5xv6qr4",
      "name": "Trà đào cam sả",
      "basePrice": 39000,
      "imageUrl": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600",
      "isAvailable": true,
      "categoryName": "Trà & Trái cây",
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
      ]
    }
  ],
  "timestamp": "2026-10-13T08:39:03.235Z"
}
```

### 3.2. Bảng mô tả chi tiết trường dữ liệu (Field Specifications)

| Tên trường | Kiểu dữ liệu | Bắt buộc | Nguồn CSDL (`schema.prisma`) | Mô tả & Quy ước |
| :--- | :--- | :---: | :--- | :--- |
| `success` | `boolean` | Có | Interceptor | Luôn là `true` khi gọi thành công |
| `statusCode` | `number` | Có | Interceptor | `200` |
| `data` | `Array<ProductItem>` | Có | Database Query | Danh sách các đối tượng món thỏa mãn điều kiện |
| `data[].id` | `string` | Có | `Product.id` | Mã định danh CUID của sản phẩm |
| `data[].name` | `string` | Có | `Product.name` | Tên đồ uống |
| `data[].basePrice` | `number` | Có | `Product.basePrice` | Giá cơ bản (VND nguyên chẵn, convert từ Prisma `Decimal`) |
| `data[].imageUrl` | `string \| null` | Không | `Product.imageUrl` | Đường dẫn ảnh sản phẩm (Unsplash URL hoặc ảnh lưu trữ) |
| `data[].isAvailable` | `boolean` | Có | Tính toán từ `Product.isAvailable && Product.stock > 0` | Trạng thái mở bán (luôn `true` trong danh sách menu) |
| `data[].categoryName` | `string \| null` | Không | `Category.name` | Tên danh mục của sản phẩm. Nếu không có danh mục thì là `null` |
| `data[].sizePrices` | `Array<SizePrice>` | Có | Quan hệ `ProductSizePrice` | Danh sách các kích cỡ và mức phụ thu tương ứng |
| `data[].sizePrices[].size` | `string` | Có | `ProductSizePrice.size` | Kích cỡ món theo enum: `'S'`, `'M'`, `'L'` |
| `data[].sizePrices[].priceAdjustment` | `number` | Có | `ProductSizePrice.priceAdjustment` | Phụ thu kích cỡ (VND nguyên chẵn: `0`, `5000`, `10000`) |
| `timestamp` | `string` | Có | Interceptor | Thời điểm trả về phản hồi theo chuẩn ISO-8601 |

---

## 4. PHẢN HỒI LỖI (ERROR RESPONSES)

Tất cả phản hồi lỗi được chuẩn hóa bọc qua `AllExceptionsFilter` (`docs/checklist-review.md`):

```json
{
  "success": false,
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Không thể tải danh sách sản phẩm từ cơ sở dữ liệu.",
  "timestamp": "2026-10-13T08:39:03.235Z",
  "path": "/api/v1/products"
}
```

### Các kịch bản lỗi chi tiết:

| Mã HTTP | Tên lỗi (`error`) | Nguyên nhân | Hành vi xử lý ở Frontend |
| :---: | :--- | :--- | :--- |
| `500` | `Internal Server Error` | Lỗi truy vấn cơ sở dữ liệu hoặc crash phía máy chủ | Hiển thị thông báo "Không thể kết nối đến máy chủ" kèm nút **Thử lại** (`Retry`). |
| `None` | Lỗi mạng / Offline | Khách hàng mất kết nối Internet hoặc Server tắt | Hiển thị Error State mạng kèm nút **Thử lại**. |
| `200` | *(Không phải lỗi)* | Cơ sở dữ liệu chưa có món nào mở bán (`data: []`) | Hiển thị Empty Menu State: "Hiện chưa có món nào mở bán." |

---

## 5. HƯỚNG DẪN TÍCH HỢP FRONTEND (FRONTEND INTEGRATION NOTES)

1. **Gọi API:** Gọi `fetchApi<ProductItem[]>('/products')` khi trang Menu được mount (Next.js client component hoặc SSR).
2. **Xử lý danh mục (Category Tabs):**
   * Frontend duyệt qua mảng `products` để trích xuất danh sách các `categoryName` duy nhất theo thứ tự xuất hiện.
   * Tab đầu tiên luôn là `"Tất cả"`.
   * Các món có `categoryName === null` hoặc không có danh mục sẽ được gom vào tab `"Khác"`.
3. **Tìm kiếm (Search):**
   * Sử dụng hàm loại bỏ dấu tiếng Việt kết hợp `toLowerCase()` và `trim()`.
   * Ví dụ hàm chuẩn hóa:
     ```typescript
     export function removeVietnameseTones(str: string): string {
       return str
         .normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '')
         .replace(/đ/g, 'd')
         .replace(/Đ/g, 'D');
     }
     ```
4. **Lọc kết hợp (Combined Filter):**
   * Danh sách hiển thị = Sản phẩm thỏa mãn (`tab === 'Tất cả'` HOẶC `item.categoryName === tab`) VÀ (`removeVietnameseTones(item.name).includes(keyword)`).
5. **Điều hướng sang Product Detail:**
   * Khi khách hàng click vào thẻ `ProductCard`, điều hướng sang route `/products/[id]` để xem chi tiết và tùy biến kích cỡ/topping (`GET /api/v1/products/:id`).

---

## 6. QUYẾT ĐỊNH KIẾN TRÚC & PHẠM VI (OUT OF SCOPE)

* **ProductsModule dùng chung:** Triển khai API này bên trong `backend/src/modules/products/` (`products.controller.ts` hàm `getProducts()`, `products.service.ts`), không tạo module riêng `product-catalog`.
* **API `GET /api/v1/categories`:** Hoãn lại sang **Sprint 2** theo quyết định của Nhóm trưởng.
* **Phân trang (Pagination) & Query Params:** Không áp dụng cho phiên bản hiện tại; sẽ đánh giá lại nếu số lượng sản phẩm vượt quá 100 món.
