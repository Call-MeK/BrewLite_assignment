# 🧱 FE-BE SKELETON: CART STRUCTURE & IMPLEMENTATION

Tài liệu thiết kế cấu trúc mã nguồn chi tiết cho phân hệ Giỏ hàng (Cart) ở cả Frontend (Next.js + Zustand) và Backend (NestJS + Prisma).

---

## 1. Frontend Skeleton (Next.js 15 App Router & Zustand)

### 1.1. Store quản lý trạng thái giỏ hàng (Zustand + Persist)
`frontend/src/store/useCartStore.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  /**
   * Khóa định danh duy nhất của từng dòng giỏ hàng:
   * Được sinh từ: `${productId}-${size}-${toppingIds.sort().join('-')}`
   * Giúp phân biệt chính xác 2 ly cùng loại, cùng size nhưng khác Topping.
   */
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  size: 'S' | 'M' | 'L';
  toppingIds: string[];
  quantity: number;
  estimatedUnitPrice: number; // Đơn giá tạm tính (basePrice + sizePrice + toppings)
  currency: 'VND';
}

export interface CartState {
  items: CartItem[];
  totalAmount: number; // Tổng tiền tạm tính toàn bộ giỏ hàng
  badgeCount: number;  // Tổng số lượng ly hiển thị trên Badge icon
  pendingOrderId: string | null; // ID đơn hàng PENDING đang chờ thanh toán (Quyết định D2)

  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  setPendingOrderId: (orderId: string | null) => void;
  clearCart: () => void; // Chỉ gọi khi đơn thanh toán PAID thành công (Quyết định D2)
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      totalAmount: 0,
      badgeCount: 0,
      pendingOrderId: null,

      setPendingOrderId: (orderId) => set({ pendingOrderId: orderId }),

      addItem: (newItem) => {
        // Sinh composite key duy nhất dựa trên productId, size và danh sách topping đã sắp xếp
        const cartItemId = `${newItem.productId}-${newItem.size}-${[...newItem.toppingIds].sort().join('-')}`;
        const currentItems = get().items;
        const existingIndex = currentItems.findIndex((item) => item.id === cartItemId);

        let updatedItems: CartItem[];
        if (existingIndex > -1) {
          // Nếu đã tồn tại món có cấu hình y hệt, cộng dồn số lượng
          updatedItems = [...currentItems];
          updatedItems[existingIndex].quantity += newItem.quantity;
        } else {
          // Thêm dòng mới vào giỏ hàng
          updatedItems = [...currentItems, { ...newItem, id: cartItemId }];
        }

        const totalAmount = updatedItems.reduce(
          (sum, item) => sum + item.estimatedUnitPrice * item.quantity,
          0
        );
        const badgeCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

        set({ items: updatedItems, totalAmount, badgeCount });
      },

      removeItem: (cartItemId) => {
        const updatedItems = get().items.filter((item) => item.id !== cartItemId);
        const totalAmount = updatedItems.reduce(
          (sum, item) => sum + item.estimatedUnitPrice * item.quantity,
          0
        );
        const badgeCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

        set({ items: updatedItems, totalAmount, badgeCount });
      },

      updateQuantity: (cartItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }

        const updatedItems = get().items.map((item) =>
          item.id === cartItemId ? { ...item, quantity } : item
        );
        const totalAmount = updatedItems.reduce(
          (sum, item) => sum + item.estimatedUnitPrice * item.quantity,
          0
        );
        const badgeCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

        set({ items: updatedItems, totalAmount, badgeCount });
      },

      clearCart: () => {
        set({ items: [], totalAmount: 0, badgeCount: 0, pendingOrderId: null });
      },
    }),
    {
      name: 'brewlite_cart_storage', // Key lưu trong LocalStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### 1.2. Cấu trúc Component giao diện
Các component được tổ chức theo quy chuẩn React & Tailwind CSS:
* `frontend/src/components/cart/CartDrawer.tsx`: Khung trượt bên phải hiển thị danh sách giỏ hàng, tổng tiền và nút Thanh toán.
* `frontend/src/components/cart/CartItemCard.tsx`: Thẻ hiển thị từng dòng món (ảnh, tên, size, danh sách topping, bộ điều khiển tăng/giảm `+ / -` và nút xóa).
* `frontend/src/components/cart/CartEmptyState.tsx`: Giao diện khi giỏ hàng trống kèm nút bấm điều hướng về thực đơn.

### 1.3. Service kết nối API (Frontend Service)
`frontend/src/services/order.service.ts`

```typescript
import { fetchApi } from '@/lib/api-client';

export interface CheckoutItemPayload {
  productId: string;
  size: 'S' | 'M' | 'L';
  toppingIds: string[];
  quantity: number;
}

export interface CreateOrderPayload {
  items: CheckoutItemPayload[];
  promotionCode?: string;
}

export interface CreateOrderResponse {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

export const checkoutCart = async (payload: CreateOrderPayload) => {
  return fetchApi<CreateOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
```

---

## 2. Backend Skeleton (NestJS DTO & Validation)

Bộ Data Transfer Object (DTO) nhận request từ giỏ hàng để tạo đơn hàng mới, đảm bảo tính toàn vẹn dữ liệu trước khi xử lý nghiệp vụ tại Controller & Service:

`backend/src/modules/orders/dto/create-order.dto.ts`

```typescript
import {
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsString({ message: 'productId phải là chuỗi hợp lệ' })
  productId: string;

  @IsIn(['S', 'M', 'L'], {
    message: 'Kích cỡ món (size) bắt buộc phải là một trong các giá trị: S, M, L',
  })
  size: 'S' | 'M' | 'L';

  @IsArray({ message: 'toppingIds phải là một mảng danh sách ID' })
  @ArrayUnique({ message: 'toppingIds không được chứa giá trị trùng lặp' })
  @ArrayMaxSize(3, { message: 'Mỗi món chỉ được chọn tối đa 3 loại topping' })
  @IsString({ each: true, message: 'Mỗi toppingId phải là một chuỗi hợp lệ' })
  toppingIds: string[];

  @IsInt({ message: 'Số lượng (quantity) phải là số nguyên' })
  @Min(1, { message: 'Số lượng mỗi món phải lớn hơn hoặc bằng 1' })
  @Max(99, { message: 'Số lượng mỗi món không được vượt quá 99' })
  quantity: number;
}

export class CreateOrderDto {
  @IsArray({ message: 'items phải là một mảng danh sách các món' })
  @ArrayNotEmpty({ message: 'Giỏ hàng không được để trống khi đặt hàng' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString({ message: 'Mã khuyến mãi phải là chuỗi ký tự' })
  promotionCode?: string;
}
```

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D2, D5, D7 (ngày 2026-10-16).*