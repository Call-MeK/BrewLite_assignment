# BrewLite — FE/BE Skeleton: Product Detail

**Trạng thái:** Chuẩn hóa theo quyết định của Nhóm trưởng  
**Người phụ trách:** Product Detail (Vũ Hoàng Huy)  
**Giai đoạn:** Architecture Mapping  
**Cập nhật lần cuối:** 13/10/2026  

---

## 1. Mục đích

Tài liệu này xác định vị trí triển khai chức năng Product Detail dựa trên cấu trúc thư mục hiện tại của BrewLite.

Mục tiêu:

* Tuân thủ cấu trúc repository mà nhóm đã thống nhất.
* Xác định vị trí các file Frontend và Backend.
* Phân chia trách nhiệm giữa giao diện, API client, controller và service.
* Bảo đảm việc triển khai phù hợp với `api-contract.md`, `db-mapping-product-detail.md` và `schema.prisma`.

---

## 2. Kiến trúc hiện tại

Repository được chia thành các phần chính:

| Thư mục/File | Trách nhiệm |
| :--- | :--- |
| `backend/` | NestJS API, chạy ở port `4000` |
| `backend/src/common/` | Interceptor (`TransformInterceptor`) và exception filter (`AllExceptionsFilter`) |
| `backend/src/modules/products/` | **ProductsModule dùng chung** cho cả Catalog (`GET /products`) và Detail (`GET /products/:id`) |
| `backend/src/prisma/` | Prisma service và client |
| `backend/prisma/schema.prisma` | Định nghĩa schema PostgreSQL |
| `frontend/` | Next.js App Router, chạy ở port `3000` |
| `frontend/src/app/` | Các trang và route của ứng dụng (`/menu`, `/products/[id]`) |
| `frontend/src/components/` | Component UI nghiệp vụ |
| `frontend/src/lib/api-client.ts` | Wrapper `fetchApi` dùng chung để gọi Backend |
| `docs/` | Tài liệu kỹ thuật và quy ước làm việc |

---

## 3. Cấu trúc triển khai cho Product Detail

### 3.1. Frontend

```text
frontend/
└── src/
    ├── app/
    │   └── products/
    │       └── [id]/
    │           └── page.tsx        # Nhận ID từ URL và hiển thị trang chi tiết sản phẩm
    │
    ├── components/product-detail/
    │   ├── ProductInfo.tsx         # Hiển thị tên, hình ảnh và trạng thái isAvailable
    │   ├── SizeSelector.tsx        # Chọn kích cỡ từ mảng sizePrices
    │   ├── ToppingSelector.tsx     # Chọn topping
    │   └── ProductPrice.tsx        # Hiển thị giá gốc và giá ước tính
    │
    ├── services/
    │   └── product.service.ts      # Chứa hàm getProductById(id)
    └── types/
        └── product.ts              # Kiểu dữ liệu ProductItem, SizePrice dùng chung
```

### 3.2. Backend

Theo **Quyết định 2 của Nhóm trưởng**, không tạo module riêng. Cả Product Catalog và Product Detail cùng chia sẻ module `products/`:

```text
backend/src/modules/products/
├── products.module.ts              # Module chung: export ProductsService
├── products.controller.ts          # Controller chung: chứa getProducts() và getProductById(id)
├── products.service.ts             # Service chung: chứa getProducts() và getProductById(id)
└── dto/
    └── product-detail.dto.ts       # Định nghĩa DTO response chi tiết sản phẩm
```

### 3.3. Trách nhiệm Backend

| File | Trách nhiệm |
| :--- | :--- |
| `products.module.ts` | Khai báo module Products dùng chung và kết nối controller/service |
| `products.controller.ts` | Tiếp nhận request `GET /api/v1/products/:id` (Vũ Hoàng Huy) và `GET /api/v1/products` (Đinh Nhật Lan) |
| `products.service.ts` | Thực hiện truy vấn Prisma `findUnique` và trả về `isAvailable = Product.isAvailable && stock > 0` |
| `dto/product-detail.dto.ts` | Định nghĩa interface response theo API Contract |

---

## 4. API của Product Detail

| Thuộc tính | Giá trị |
| :--- | :--- |
| Method | `GET` |
| Endpoint | `/api/v1/products/:id` |
| Controller | `ProductsController.getProductById(id)` |
| Service | `ProductsService.getProductById(id)` |
| Response thành công | `200 OK` |
| Không tìm thấy | `404 Not Found` |

---

## 5. Mapping với database (Quyết định 1 & 5)

| Trường API | Nguồn dữ liệu | Ghi chú & Quyết định |
| :--- | :--- | :--- |
| `id` | `Product.id` | CUID |
| `name` | `Product.name` | Tên sản phẩm |
| `imageUrl` | `Product.imageUrl` | Có thể `null` |
| `basePrice` | `Product.basePrice` | Number nguyên chẵn (VND) |
| `currency` | Quy ước API | `"VND"` |
| `isAvailable` | `Product.isAvailable && Product.stock > 0` | **Quyết định 1 & 5:** Dùng `isAvailable`, không trả `stock` |
| `sizePrices` | `ProductSizePrice` | **Quyết định 1:** Dùng `sizePrices` thay cho `sizes` |
| `sizePrices[].size` | `ProductSizePrice.size` | Enum `'S'`, `'M'`, `'L'` |
| `sizePrices[].priceAdjustment` | `ProductSizePrice.priceAdjustment` | Phụ phí kích cỡ |
| `toppings` | `Topping (isAvailable && stock > 0)` | **Quyết định D3:** Trả toàn bộ topping khả dụng (id, name, price). Không dùng bảng `ProductTopping` |

---

## 6. Trạng thái giao diện

| Trạng thái | Hành vi dự kiến |
| :--- | :--- |
| Loading | Hiển thị skeleton loader chi tiết món |
| Success | Hiển thị thông tin sản phẩm và form tùy chỉnh |
| Not Found (404) | Thông báo không tìm thấy sản phẩm |
| Error (500) | Hiển thị thông báo lỗi và nút thử lại |
| Unavailable / Out of Stock | Khi `isAvailable === false`, hiển thị huy hiệu "Hết hàng" và khóa nút thêm vào giỏ |

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D3 (ngày 2026-10-16).*