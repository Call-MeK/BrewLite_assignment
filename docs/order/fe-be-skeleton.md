# 🧱 BỘ KHUNG FE-BE SKELETON: ORDER MODULE

> **Feature:** Order (Tạo đơn hàng & Quản lý trạng thái)  
> **Tác giả:** Vo Thi Thuy
> **Phiên bản:** v1.0 (Kiến trúc Tuần 1)  
> **Mục tiêu:** Cung cấp mã khung (Skeleton) chuẩn NestJS phía Backend và React/Next.js phía Frontend theo tiêu chuẩn quy ước chung của BrewLite, làm nền tảng triển khai cho Sprint 2.

---

## 1. PHÍA BACKEND (NESTJS)

### 1.1. Data Transfer Objects (DTO) kèm Validation

File tham khảo: `backend/src/modules/orders/dto/create-order.dto.ts`

```typescript
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ArrayNotEmpty,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductSize } from '@prisma/client';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: string;

  @IsOptional()
  @IsEnum(ProductSize, { message: 'size phải là S, M hoặc L' })
  size?: ProductSize = ProductSize.M;

  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity tối thiểu là 1' })
  @Max(99, { message: 'quantity tối đa là 99 cho mỗi dòng món' })
  quantity: number;

  @IsOptional()
  @IsArray({ message: 'toppingIds phải là một mảng' })
  @IsString({ each: true, message: 'Mỗi toppingId phải là chuỗi' })
  @ArrayUnique({ message: 'Danh sách topping không được chứa ID trùng lặp' })
  @ArrayMaxSize(3, { message: 'Mỗi món chỉ được chọn tối đa 3 loại topping' })
  toppingIds?: string[] = [];
}

export class CreateOrderDto {
  @IsArray({ message: 'items phải là một mảng danh sách món' })
  @ArrayNotEmpty({ message: 'Đơn hàng phải có ít nhất một sản phẩm' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString({ message: 'Mã khuyến mãi phải là chuỗi ký tự' })
  promotionCode?: string;
}
```

---

### 1.2. Controller Skeleton (`orders.controller.ts`)

File tham khảo: `backend/src/modules/orders/orders.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
// Giả định JwtAuthGuard từ common/guards
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('orders')
// @UseGuards(JwtAuthGuard) // Bắt buộc đăng nhập để tạo hoặc hủy đơn
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: any, // req.user.sub lấy từ JwtAuthGuard (D4)
    @Body() dto: CreateOrderDto,
  ) {
    const userId = req.user?.sub;
    return this.ordersService.create(userId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub;
    return this.ordersService.cancel(id, userId);
  }
}
```

---

### 1.3. Service Skeleton & State Transition (`orders.service.ts`)

File tham khảo: `backend/src/modules/orders/orders.service.ts`

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductSize, OrderStatus, Prisma } from '@prisma/client';

// Bảng ma trận chuyển đổi trạng thái hợp lệ (9 chuyển tiếp giữa các trạng thái + 1 bước khởi tạo theo PDF)
const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED, // Giữ ở mức service/state machine theo PDF
  ],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra chuyển trạng thái hợp lệ theo State Machine
   */
  assertTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new ConflictException(
        `Không thể chuyển trạng thái đơn hàng từ ${from} sang ${to}`,
      );
    }
  }

  /**
   * Tạo đơn hàng mới trong Transaction nguyên tử
   */
  async create(userId: string, dto: CreateOrderDto) {
    if (!userId) {
      throw new BadRequestException('Không tìm thấy thông tin định danh người dùng');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Kiểm tra User tồn tại
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Người dùng không tồn tại');
      }

      let totalAmount = new Prisma.Decimal(0);
      const orderItemsToCreate: Prisma.OrderItemCreateWithoutOrderInput[] = [];

      // 2. Duyệt từng dòng món, kiểm tra tồn kho và tính giá server-side
      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { sizePrices: true },
        });

        if (!product || !product.isAvailable) {
          throw new BadRequestException(`Sản phẩm ${item.productId} không khả dụng`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(`Sản phẩm ${product.name} không đủ tồn kho`);
        }

        // Cập nhật tồn kho sản phẩm có điều kiện (Optimistic decrement)
        const updateProduct = await tx.product.updateMany({
          where: {
            id: product.id,
            isAvailable: true,
            version: product.version,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });

        if (updateProduct.count !== 1) {
          throw new BadRequestException(`Xung đột tồn kho cho sản phẩm ${product.name}`);
        }

        // Tìm phụ thu kích cỡ
        const size = item.size ?? ProductSize.M;
        const sizePrice = product.sizePrices.find((sp) => sp.size === size);
        if (!sizePrice) {
          throw new BadRequestException(`Sản phẩm ${product.name} không có size ${size}`);
        }

        // Xử lý toppings
        const toppingIds = item.toppingIds ?? [];
        const toppings = toppingIds.length > 0
          ? await tx.topping.findMany({ where: { id: { in: toppingIds } } })
          : [];

        if (toppings.length !== toppingIds.length) {
          throw new NotFoundException('Có topping không tồn tại trong hệ thống');
        }

        for (const top of toppings) {
          if (!top.isAvailable) {
            throw new BadRequestException(`Topping ${top.name} không khả dụng`);
          }
          // D3: cập nhật có điều kiện (Topping không có cột version); mỗi ly dùng 1 phần topping
          const updatedTopping = await tx.topping.updateMany({
            where: { id: top.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updatedTopping.count === 0) {
            throw new BadRequestException(`Topping ${top.name} đã hết hàng`);
          }
        }

        // Tính giá: lineTotal = (unitPrice + Σ toppingPrice) * quantity
        const unitPrice = new Prisma.Decimal(product.basePrice).add(sizePrice.priceAdjustment);
        const toppingTotal = toppings.reduce(
          (sum, t) => sum.add(t.price),
          new Prisma.Decimal(0),
        );
        const lineTotal = unitPrice.add(toppingTotal).mul(item.quantity);
        totalAmount = totalAmount.add(lineTotal);

        orderItemsToCreate.push({
          product: { connect: { id: product.id } },
          size,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          toppings: {
            create: toppings.map((t) => ({
              topping: { connect: { id: t.id } },
              price: t.price,
            })),
          },
        });
      }

      // 3. Tạo Order và bản ghi lịch sử trạng thái
      return tx.order.create({
        data: {
          user: { connect: { id: user.id } },
          status: OrderStatus.PENDING,
          totalAmount,
          discountAmount: new Prisma.Decimal(0),
          finalAmount: totalAmount,
          items: { create: orderItemsToCreate },
          statusHistory: {
            create: {
              fromStatus: null as any, // Open item: fromStatus nullable migration
              toStatus: OrderStatus.PENDING,
              changedBy: 'system',
              reason: 'Order created',
            },
          },
        },
        include: {
          items: {
            include: {
              product: true,
              toppings: { include: { topping: true } },
            },
          },
        },
      });
    });
  }

  /**
   * Hủy đơn hàng (POST /orders/:id/cancel - D6)
   */
  async cancel(orderId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { toppings: true } } },
      });

      if (!order || order.userId !== userId) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
        throw new ConflictException('Đơn hàng không ở trạng thái cho phép hủy');
      }

      // Hoàn lại tồn kho
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            version: { increment: 1 },
          },
        });

        for (const top of item.toppings) {
          await tx.topping.update({
            where: { id: top.toppingId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      this.assertTransition(order.status, OrderStatus.CANCELLED);

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: OrderStatus.CANCELLED,
              changedBy: 'customer',
              reason: 'Customer cancelled',
            },
          },
        },
      });
    });
  }
}
```

---

## 2. PHÍA FRONTEND (NEXT.JS & REACT)

### 2.1. TypeScript Interfaces

File tham khảo: `frontend/src/types/order.ts`

```typescript
export interface CreateOrderItemInput {
  productId: string;
  size: 'S' | 'M' | 'L';
  quantity: number; // 1..99
  toppingIds: string[];
}

export interface CreateOrderInput {
  items: CreateOrderItemInput[];
  promotionCode?: string;
}

export interface OrderResponse {
  id: string;
  orderNumber: number;
  userId: string;
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'PAYMENT_FAILED' | 'CANCELLED';
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  createdAt: string;
}
```

---

### 2.2. Custom Hook Tạo Đơn (`useCreateOrder.ts`)

File tham khảo: `frontend/src/hooks/useCreateOrder.ts`

```typescript
import { useState } from 'react';
import { fetchApi } from '@/lib/api-client';
import { CreateOrderInput, OrderResponse } from '@/types/order';

export function useCreateOrder() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async (input: CreateOrderInput): Promise<OrderResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // fetchApi tự động đính kèm Authorization: Bearer <token> từ auth storage
      const res = await fetchApi<OrderResponse>('/orders', {
        method: 'POST',
        body: JSON.stringify(input),
      });

      return res;
    } catch (err: any) {
      const msg = err.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { createOrder, isLoading, error };
}
```

## 3. Lịch sử thay đổi
- v1.0 (2026-10-10): Khởi tạo tài liệu FE-BE Skeleton Order Module.
- v1.1 – áp dụng quyết định D1, D3, D5, D6, D7 (ngày 2026-10-16).
