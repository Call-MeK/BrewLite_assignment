# 🗄️ DATABASE MAPPING – PRODUCT CATALOG (MENU SẢN PHẨM)

**Phân hệ:** Product Catalog (CAT)  
**Tác giả:** Võ Thị Thủy (Owner Feature: Product Catalog)  
**API liên kết:** `GET /api/v1/products`  
**Giai đoạn:** Architecture Mapping (Tuần 1)  

---

## 1. TỔNG QUAN

Tài liệu này đặc tả quy tắc ánh xạ (mapping) giữa Cơ sở dữ liệu quan hệ PostgreSQL (thông qua Prisma ORM tại `backend/prisma/schema.prisma`) và Cấu trúc dữ liệu phản hồi (API Response DTO) của API `GET /api/v1/products`.

Hệ thống truy xuất dữ liệu từ bảng chính `products` và liên kết (JOIN) với hai bảng quan hệ là `categories` và `product_size_prices`.

---

## 2. BẢNG ÁNH XẠ THỰC THỂ (ENTITY TO RESPONSE MAPPING)

### 2.1. Bảng `products` (Model `Product`)

| Cột trong DB (`PostgreSQL`) | Trường trong Prisma | Kiểu CSDL | Trường trong API Response | Kiểu API | Quy tắc & Xử lý nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `VARCHAR` | `id` | `string` | Khóa chính CUID, định danh duy nhất cho sản phẩm. |
| `name` | `name` | `VARCHAR` | `name` | `string` | Tên đồ uống hiển thị trên thẻ menu. |
| `base_price` | `basePrice` | `DECIMAL(12, 0)` | `basePrice` | `number` | Giá bán gốc. Convert từ Prisma `Decimal` sang `Number` (VND nguyên chẵn). |
| `image_url` | `imageUrl` | `VARCHAR` | `imageUrl` | `string \| null` | Đường dẫn ảnh sản phẩm. Cho phép `null` nếu chưa có ảnh. |
| `is_available` | `isAvailable` | `BOOLEAN` | `isAvailable` | `boolean` | **Quyết định 5:** Backend tính toán trả về `true` cho các sản phẩm mở bán và còn hàng. |
| `stock` | `stock` | `INTEGER` | *(Không trả ra API)* | — | **Quyết định 5:** Trường nội bộ trong CSDL. Backend dùng điều kiện `stock > 0` trong câu lệnh WHERE để lọc món, tuyệt đối không trả trường `stock` ra ngoài API. |
| `category_id` | `categoryId` | `VARCHAR` | *(Không trả trực tiếp)* | — | Khóa ngoại trỏ sang `categories.id` dùng để JOIN lấy tên danh mục. |
| `version` | `version` | `INTEGER` | *(Không trả ra API)* | — | Trường nội bộ phục vụ Optimistic Locking (Task 10). |
| `created_at` | `createdAt` | `TIMESTAMP` | *(Không trả ra API)* | — | Thời gian tạo bản ghi. |
| `updated_at` | `updatedAt` | `TIMESTAMP` | *(Không trả ra API)* | — | Thời gian cập nhật bản ghi. |

---

### 2.2. Bảng `categories` (Model `Category`)

| Cột trong DB (`PostgreSQL`) | Trường trong Prisma | Kiểu CSDL | Trường trong API Response | Kiểu API | Quy tắc & Xử lý nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `name` | `name` | `VARCHAR` | `categoryName` | `string \| null` | Tên hiển thị của danh mục (ví dụ: `"Cà phê"`, `"Trà & Trái cây"`). Nếu sản phẩm chưa gán danh mục thì trả `null` (Frontend sẽ gom vào tab `"Khác"`). |
| `slug` | `slug` | `VARCHAR` | *(Chưa dùng ở API này)* | — | Định danh danh mục dạng URL-friendly (để dành cho Sprint 2). |
| `display_order`| `displayOrder` | `INTEGER` | *(Chưa dùng ở API này)* | — | Thứ tự sắp xếp danh mục hiển thị (để dành cho Sprint 2). |

---

### 2.3. Bảng `product_size_prices` (Model `ProductSizePrice`)

| Cột trong DB (`PostgreSQL`) | Trường trong Prisma | Kiểu CSDL | Trường trong API Response | Kiểu API | Quy tắc & Xử lý nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `size` | `size` | `ENUM ('S','M','L')`| `sizePrices[].size` | `string` | Kích cỡ món theo quy chuẩn enum: `'S'`, `'M'`, `'L'`. |
| `price_adjustment` | `priceAdjustment` | `DECIMAL(12, 0)` | `sizePrices[].priceAdjustment` | `number` | Phụ thu tương ứng với từng kích cỡ (ví dụ: S = 0đ, M = +5.000đ, L = +10.000đ). Convert sang `Number`. |

---

## 3. CÂU LỆNH TRUY VẤN PRISMA MẪU (PRISMA QUERY IMPLEMENTATION)

Tại `backend/src/modules/products/products.service.ts`, hàm `getProducts()` thực thi truy vấn an toàn và tối ưu như sau:

```typescript
// backend/src/modules/products/products.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    const rawProducts = await this.prisma.product.findMany({
      where: {
        isAvailable: true, // Chỉ lấy sản phẩm có trạng thái mở bán
        stock: { gt: 0 },  // Quyết định 5: Chỉ lấy sản phẩm còn hàng trong kho
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        sizePrices: {
          select: {
            size: true,
            priceAdjustment: true,
          },
          orderBy: {
            priceAdjustment: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc', // Quyết định 1 & BR-CAT-02: Sắp xếp theo tên tăng dần
      },
    });

    // Chuyển đổi Prisma Decimal sang JavaScript Number và chuẩn hóa response DTO
    return rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      basePrice: Number(p.basePrice),
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable, // Luôn true vì đã qua bộ lọc where
      categoryName: p.category?.name ?? null,
      sizePrices: p.sizePrices.map((sp) => ({
        size: sp.size,
        priceAdjustment: Number(sp.priceAdjustment),
      })),
    }));
  }
}
```

---

## 4. QUY TẮC TOÀN VẸN VÀ BẢO MẬT DỮ LIỆU

1. **Chuyển đổi kiểu tiền tệ (`Decimal` ➔ `number`):**
   * Trong PostgreSQL, `basePrice` và `priceAdjustment` là `Decimal(12, 0)` để đảm bảo độ chính xác tuyệt đối và tương thích với tiền tệ VND.
   * Khi trả về qua JSON API, Backend chuyển thành số nguyên `number` để Frontend hiển thị và tính toán tạm tính.
2. **Không rò rỉ dữ liệu kho (`Zero Stock Leakage`):**
   * Trường `stock` được sử dụng như điều kiện lọc nghiệp vụ tại câu lệnh `WHERE` của CSDL, tuyệt đối không xuất hiện trong mệnh đề `SELECT` của Response DTO.
3. **Tính nhất quán giữa Catalog và Detail:**
   * Mọi tên trường (`isAvailable`, `sizePrices`, `categoryName`, `imageUrl`, `basePrice`) trong tài liệu này hoàn toàn đồng bộ với bảng mapping tại `docs/product-detail/db-mapping-product-detail.md`.
