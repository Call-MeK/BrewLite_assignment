# 뼈대를 잡는 FE-BE SKELETON: PRODUCT CATALOG (MENU SẢN PHẨM)

**Phân hệ:** Product Catalog (CAT)  
**Tác giả:** Võ Thị Thủy (Owner Feature: Product Catalog)  
**Phiên bản:** 1.1 — Đồng bộ theo quyết định của Nhóm trưởng  
**Giai đoạn:** Architecture Mapping (Tuần 1)  

---

## 1. TỔNG QUAN KIẾN TRÚC & PHÂN BỔ TRÁCH NHIỆM

Tuân thủ nghiêm ngặt **Quyết định 2 của Nhóm trưởng** và `docs/naming-convention.md`:
* **Phía Backend:** Không tạo module riêng `product-catalog`. Toàn bộ chức năng hiển thị danh sách Menu (`GET /api/v1/products`) và chức năng xem Chi tiết sản phẩm (`GET /api/v1/products/:id`) được gom chung vào module duy nhất: `backend/src/modules/products/`.
  * **Đinh Nhật Lan (Catalog):** Phụ trách method `getProducts()` trong `ProductsController` và `ProductsService`.
  * **Vũ Hoàng Huy (Detail):** Phụ trách method `getProductById(id)` trong cùng `ProductsController` và `ProductsService`.
* **Phía Frontend:** Cung cấp trang Menu tại `frontend/src/app/menu/page.tsx`, bộ component hiển thị lưới đồ uống, và custom hook `useProductCatalog` xử lý tìm kiếm không dấu và lọc danh mục tại Client-side.

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```
BrewLite/
├── backend/src/modules/products/
│   ├── products.module.ts              # Module quản lý tài nguyên Sản phẩm
│   ├── products.controller.ts          # Controller: GET /products (Lan) & GET /products/:id (Huy)
│   ├── products.service.ts             # Service: getProducts (Lan) & getProductById (Huy)
│   └── dto/
│       ├── product-response.dto.ts     # DTO response cho danh sách và chi tiết món
│       └── product-detail.dto.ts       # DTO chi tiết sản phẩm kèm toppings
│
└── frontend/src/
    ├── app/
    │   └── menu/
    │       └── page.tsx                # Trang hiển thị Thực đơn đồ uống
    ├── components/product-catalog/
    │   ├── ProductCard.tsx             # Thẻ hiển thị món (ảnh, tên, giá, badge)
    │   ├── ProductList.tsx             # Lưới hiển thị danh sách sản phẩm
    │   ├── CategoryTabs.tsx            # Thanh tab danh mục tự động (distinct categoryName)
    │   ├── ProductSearchBar.tsx        # Thanh tìm kiếm thời gian thực
    │   ├── ProductSkeleton.tsx         # Khung xương loading shimmer
    │   └── ProductEmptyState.tsx       # Giao diện khi rỗng hoặc không tìm thấy kết quả
    ├── hooks/
    │   └── useProductCatalog.ts        # Hook xử lý tìm kiếm không dấu và lọc danh mục
    ├── services/
    │   └── product.service.ts          # Gọi fetchApi('/products')
    └── types/
        └── product.ts                  # Interface ProductItem dùng chung toàn hệ thống
```

---

## 3. KHUNG MÃ NGUỒN FRONTEND (FRONTEND SKELETON)

### 3.1. Type Định Nghĩa Dùng Chung — `frontend/src/types/product.ts`

```typescript
// frontend/src/types/product.ts

export type ProductSize = 'S' | 'M' | 'L';

export interface SizePrice {
  size: ProductSize;
  priceAdjustment: number;
}

/**
 * Interface sản phẩm dùng chung cho cả Product Catalog và Cart/Detail
 * Quyết định 1: Thống nhất dùng isAvailable và sizePrices theo schema.prisma
 */
export interface ProductItem {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryName: string | null;
  sizePrices: SizePrice[];
}
```

### 3.2. Service Gọi API — `frontend/src/services/product.service.ts`

```typescript
// frontend/src/services/product.service.ts
import { fetchApi } from '@/lib/api-client';
import { ProductItem } from '@/types/product';

/**
 * Lấy danh sách sản phẩm mở bán và còn hàng
 * Endpoint: GET /api/v1/products
 */
export const getProductCatalog = async (): Promise<ProductItem[]> => {
  return fetchApi<ProductItem[]>('/products');
};
```

### 3.3. Custom Hook Quản Lý State & Bộ Lọc — `frontend/src/hooks/useProductCatalog.ts`

```typescript
// frontend/src/hooks/useProductCatalog.ts
import { useState, useMemo, useEffect } from 'react';
import { ProductItem } from '@/types/product';
import { getProductCatalog } from '@/services/product.service';

/**
 * Hàm chuẩn hóa loại bỏ dấu tiếng Việt (Quyết định 4 của Nhóm trưởng)
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function useProductCatalog() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProductCatalog();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách thực đơn');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quyết định 3: Trích xuất distinct categoryName theo thứ tự xuất hiện, gom null vào "Khác"
  const categories = useMemo(() => {
    const set = new Set<string>();
    let hasUncategorized = false;

    products.forEach((p) => {
      if (p.categoryName) {
        set.add(p.categoryName);
      } else {
        hasUncategorized = true;
      }
    });

    const list = ['Tất cả', ...Array.from(set)];
    if (hasUncategorized) {
      list.push('Khác');
    }
    return list;
  }, [products]);

  // Quyết định 4: Lọc Client-side kết hợp Danh mục và Tìm kiếm không dấu
  const filteredProducts = useMemo(() => {
    const normalizedKeyword = removeVietnameseTones(searchKeyword);

    return products.filter((item) => {
      // 1. Khớp danh mục
      let matchCategory = true;
      if (selectedCategory === 'Tất cả') {
        matchCategory = true;
      } else if (selectedCategory === 'Khác') {
        matchCategory = item.categoryName === null;
      } else {
        matchCategory = item.categoryName === selectedCategory;
      }

      // 2. Khớp từ khóa tìm kiếm (không phân biệt dấu và hoa thường)
      let matchSearch = true;
      if (normalizedKeyword) {
        const normalizedItemName = removeVietnameseTones(item.name);
        matchSearch = normalizedItemName.includes(normalizedKeyword);
      }

      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchKeyword]);

  return {
    products: filteredProducts,
    allProductsCount: products.length,
    isLoading,
    error,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchKeyword,
    setSearchKeyword,
    retry: loadData,
  };
}
```

---

## 4. KHUNG MÃ NGUỒN BACKEND (BACKEND SKELETON)

### 4.1. Module Dùng Chung — `backend/src/modules/products/products.module.ts`

```typescript
// backend/src/modules/products/products.module.ts
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### 4.2. Controller Dùng Chung — `backend/src/modules/products/products.controller.ts`

```typescript
// backend/src/modules/products/products.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * [Product Catalog - Đinh Nhật Lan]
   * Lấy danh sách toàn bộ sản phẩm mở bán và còn kho
   * Endpoint: GET /api/v1/products
   */
  @Get()
  async getProducts() {
    return this.productsService.getProducts();
  }

  /**
   * [Product Detail - Vũ Hoàng Huy]
   * Lấy chi tiết một sản phẩm theo ID để chọn size và topping
   * Endpoint: GET /api/v1/products/:id
   */
  @Get(':id')
  async getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }
}
```

### 4.3. Service Dùng Chung — `backend/src/modules/products/products.service.ts`

```typescript
// backend/src/modules/products/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * [Đinh Nhật Lan] Triển khai lấy danh sách Menu
   * Quyết định 5: Lọc isAvailable = true && stock > 0; không trả trường stock
   */
  async getProducts() {
    const rawProducts = await this.prisma.product.findMany({
      where: {
        isAvailable: true,
        stock: { gt: 0 },
      },
      include: {
        category: {
          select: { name: true },
        },
        sizePrices: {
          select: { size: true, priceAdjustment: true },
          orderBy: { priceAdjustment: 'asc' },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      basePrice: Number(p.basePrice),
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable,
      categoryName: p.category?.name ?? null,
      sizePrices: p.sizePrices.map((sp) => ({
        size: sp.size,
        priceAdjustment: Number(sp.priceAdjustment),
      })),
    }));
  }

  /**
   * [Vũ Hoàng Huy] Triển khai lấy chi tiết sản phẩm
   * Quyết định 5: Vẫn trả sản phẩm kể cả hết hàng, với cờ isAvailable = (Product.isAvailable && stock > 0)
   */
  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        sizePrices: {
          select: { size: true, priceAdjustment: true },
          orderBy: { priceAdjustment: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
    }

    // Quyết định D3: Lấy toàn bộ topping khả dụng (isAvailable && stock > 0)
    const availableToppings = await this.prisma.topping.findMany({
      where: { isAvailable: true, stock: { gt: 0 } },
      select: { id: true, name: true, price: true },
      orderBy: { price: 'asc' },
    });

    return {
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable && product.stock > 0, // Quyết định 5
      sizePrices: product.sizePrices.map((sp) => ({
        size: sp.size,
        priceAdjustment: Number(sp.priceAdjustment),
      })),
      toppings: availableToppings.map((t) => ({
        id: t.id,
        name: t.name,
        price: Number(t.price),
      })),
    };
  }
}
```

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D3 (ngày 2026-10-16).*