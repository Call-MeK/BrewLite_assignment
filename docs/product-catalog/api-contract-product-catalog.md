PRODUCT CATALOG (MENU SẢN PHẨM)
Thành viên: Võ Thị Thủy
Phân vai: Owner Feature
13/10/2026  
1. TỔNG QUAN
API cung cấp danh sách sản phẩm để Frontend hiển thị, bao gồm cả món đang hết hàng.
Phương thức: `GET`
Đường dẫn: `/api/v1/products`
Mỗi size có `availableQuantity` tính từ tồn nguyên liệu và định lượng công thức. Size chưa có công thức không xuất hiện trên menu hoặc chi tiết sản phẩm; size đã có công thức nhưng thiếu nguyên liệu hiển thị là hết hàng. Món khả dụng khi đang mở bán và có ít nhất một size khả dụng. Tồn kho được kiểm tra lại khi đặt đơn.

Quản trị viên dùng `GET /api/v1/products/:id/size-prices` để xem tất cả size, kể cả size chưa có công thức; `PUT` cùng đường dẫn nhận `{ "sizes": [{ "size": "M", "priceAdjustment": 5000 }] }`. Phụ thu là số nguyên VNĐ từ 0 đến 1.000.000.000; mỗi size chỉ xuất hiện một lần. Cả hai API yêu cầu JWT và quyền Admin. Giá đơn mới do backend tính lại; đơn đã tạo giữ giá tại thời điểm đặt.
Toàn bộ thao tác tìm kiếm theo tên (không phân biệt hoa/thường, không phân biệt dấu tiếng Việt) và lọc theo danh mục đều thực hiện tại Frontend trên danh sách đã tải về.
Không gửi query parameters (`?search=...`, `?category=...`) lên Backend trong phiên bản MVP.

---

2. YÊU CẦU (REQUEST SPECIFICATION)
2.1. HTTP Request
URL:`http://localhost:4000/api/v1/products`
Headers:
  ```http
  Accept: application/json
  ```
Request Body: Không có.
Query Parameters:Không có.

Các kịch bản lỗi chi tiết:

| Mã HTTP | Tên lỗi (`error`) | Nguyên nhân | Hành vi xử lý ở Frontend |
| :---: | :--- | :--- | :--- |
| `500` | `Internal Server Error` | Lỗi truy vấn cơ sở dữ liệu hoặc crash phía máy chủ | Hiển thị thông báo "Không thể kết nối đến máy chủ" kèm nút **Thử lại** (`Retry`). |
| `None` | Lỗi mạng / Offline | Khách hàng mất kết nối Internet hoặc Server tắt | Hiển thị Error State mạng kèm nút **Thử lại**. |
| `200` | *(Không phải lỗi)* | Cơ sở dữ liệu chưa có món nào mở bán (`data: []`) | Hiển thị Empty Menu State: "Hiện chưa có món nào mở bán." |

---

3. HƯỚNG DẪN TÍCH HỢP FRONTEND (FRONTEND INTEGRATION NOTES)

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

25/10/2026: `GET /api/v1/products` trả mảng sản phẩm đang bán và còn hàng như hợp đồng phía trên; `GET /api/v1/products/:id` trả chi tiết sản phẩm. Các hàm phân trang/lọc ở service chưa được mở thành API công khai.
