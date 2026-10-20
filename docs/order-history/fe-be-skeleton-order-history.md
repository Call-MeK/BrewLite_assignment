# BỘ KHUNG FE-BE SKELETON: ORDER HISTORY (LỊCH SỬ ĐƠN HÀNG)

**Phân hệ:** Order History (OH)
**Tác giả:** Duc Phuc (Owner Feature: Order History)
**Phiên bản:** 1.0 — Ánh xạ theo `usecase-order-history.md`
**Giai đoạn:** Architecture Mapping (Tuần 1)

---

## 1. TỔNG QUAN KIẾN TRÚC & PHÂN BỔ TRÁCH NHIỆM

Phân hệ Order History cho phép khách hàng đã đăng nhập xem các đơn hàng thuộc
tài khoản của mình, lọc theo trạng thái, phân trang/tải thêm và mở chi tiết đơn.
Tài liệu này là bộ khung triển khai FE-BE dựa trên
[`usecase-order-history.md`](./usecase-order-history.md).

* **Phía Backend:** Mở rộng module `backend/src/modules/orders/`. Endpoint
  `GET /api/v1/orders/me` lấy `userId` từ JWT, không nhận `userId` từ Client.
  Endpoint `GET /api/v1/orders/:id` được đề xuất để tải dữ liệu Order Detail và
  phải kiểm tra quyền sở hữu ở Server.
* **Phía Frontend:** Cung cấp route `frontend/src/app/orders/page.tsx`, các
  component hiển thị danh sách/card đơn hàng, bộ lọc trạng thái, Loading/Empty/
  Error states và hook `useOrderHistory` quản lý tải dữ liệu, phân trang và retry.
* **Hợp đồng dữ liệu:** Danh sách dùng `data` là mảng và `pagination` ở
  top-level. Thứ tự mặc định là `createdAt DESC`, dùng `id` làm khóa phụ ổn định.

Các quy ước đề xuất trong tài liệu use case (phân trang, response mapping và
endpoint chi tiết) cần được Backend xác nhận trước khi triển khai production.

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```
BrewLite/
├── backend/src/modules/orders/
│   ├── orders.module.ts                 # Module Order History/Order Detail
│   ├── orders.controller.ts             # GET /orders/me và GET /orders/:id
│   ├── orders.service.ts                # Query theo user, filter, pagination
│   └── dto/
│       ├── order-history-query.dto.ts   # page, limit, status
│       ├── order-history-item.dto.ts    # DTO tóm tắt một Order
│       └── order-detail.dto.ts          # DTO Order kèm OrderItem
│
└── frontend/src/
    ├── app/
    │   └── orders/
    │       ├── page.tsx                 # Trang Lịch sử đơn hàng
    │       └── [id]/
    │           └── page.tsx             # Trang chi tiết đơn hàng
    ├── components/order-history/
    │   ├── OrderHistory.tsx             # Container danh sách và các UI states
    │   ├── OrderHistoryFilters.tsx      # Bộ lọc trạng thái
    │   ├── OrderCard.tsx                # Card tóm tắt một đơn
    │   ├── OrderHistorySkeleton.tsx     # Skeleton khi tải trang đầu
    │   ├── OrderHistoryEmptyState.tsx   # Empty State
    │   ├── OrderHistoryErrorState.tsx   # Error State và nút retry
    │   └── LoadMoreOrdersButton.tsx     # Tải trang kế tiếp
    ├── hooks/
    │   └── useOrderHistory.ts           # State, filter, pagination, retry
    ├── services/
    │   └── order.service.ts             # API History và Order Detail
    └── types/
        └── order.ts                     # Interface dùng chung cho Order
```

---

## 3. KHUNG MÃ NGUỒN FRONTEND (FRONTEND SKELETON)

### 3.1. Type định nghĩa dùng chung — `frontend/src/types/order.ts`

```typescript
// frontend/src/types/order.ts

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PREPARING',
  'READY',
  'COMPLETED',
  'PAYMENT_FAILED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderHistoryItem {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  createdAt: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  itemCount?: number;
}

export interface OrderPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface OrderHistoryData {
  items: OrderHistoryItem[];
  pagination: OrderPagination;
}

export interface OrderItemToppingDetail {
  id: string;
  toppingId: string;
  name: string;
  price: number;
}

export interface OrderItemDetail {
  id: string;
  productId: string;
  name?: string;
  size: 'S' | 'M' | 'L';
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  toppings: OrderItemToppingDetail[];
}

export interface OrderDetail extends OrderHistoryItem {
  items: OrderItemDetail[];
}
```

`id` là định danh chuẩn để điều hướng tới Order Detail. `orderNumber` chỉ dùng
để hiển thị cho khách hàng và không thay thế `id` khi gọi API.

### 3.2. Service gọi API — `frontend/src/services/order.service.ts`

```typescript
// frontend/src/services/order.service.ts
import { fetchApi } from '@/lib/api-client';
import {
  OrderDetail,
  OrderHistoryItem,
  OrderPagination,
  OrderStatus,
} from '@/types/order';

export interface GetOrderHistoryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

/**
 * Lấy lịch sử đơn hàng của user hiện tại.
 * Backend lấy userId từ JWT trong Authorization header.
 * fetchApi tự động unwrap trường data: { items, pagination }.
 */
export const getOrderHistory = async (
  params: GetOrderHistoryParams = {},
): Promise<OrderHistoryData> => {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page ?? 1));
  searchParams.set('limit', String(params.limit ?? 20));
  if (params.status) {
    searchParams.set('status', params.status);
  }

  return fetchApi<OrderHistoryData>(
    `/orders/me?${searchParams.toString()}`,
  );
};

/**
 * Tải dữ liệu chuẩn cho màn hình Order Detail.
 * Snapshot từ Order History không được dùng thay cho response này.
 */
export const getOrderDetail = async (id: string): Promise<OrderDetail> => {
  return fetchApi<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
};
```

### 3.3. Custom hook quản lý state — `frontend/src/hooks/useOrderHistory.ts`

```typescript
// frontend/src/hooks/useOrderHistory.ts
import { useCallback, useEffect, useState } from 'react';
import {
  OrderHistoryItem,
  OrderPagination,
  OrderStatus,
} from '@/types/order';
import { getOrderHistory } from '@/services/order.service';

const DEFAULT_LIMIT = 20;

export function useOrderHistory() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [pagination, setPagination] = useState<OrderPagination | null>(null);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      try {
        append ? setIsLoadingMore(true) : setIsLoading(true);
        setError(null);
        const result = await getOrderHistory({
          page: nextPage,
          limit: DEFAULT_LIMIT,
          status,
        });

        setOrders((current) =>
          append ? [...current, ...result.data] : result.data,
        );
        setPagination(result.pagination);
        setPage(nextPage);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải lịch sử đơn hàng',
        );
      } finally {
        append ? setIsLoadingMore(false) : setIsLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    setOrders([]);
    setPage(1);
    void loadPage(1, false);
  }, [loadPage]);

  const changeStatus = (nextStatus: OrderStatus | undefined) => {
    setStatus(nextStatus);
  };

  const loadMore = () => {
    if (!isLoadingMore && pagination?.hasNextPage) {
      void loadPage(page + 1, true);
    }
  };

  return {
    orders,
    pagination,
    status,
    changeStatus,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry: () => void loadPage(page, page > 1 && orders.length > 0),
  };
}
```

Khi đổi bộ lọc, hook phải xóa danh sách hiện tại, đặt `page=1` và gọi lại API.
Khi tải trang sau thất bại, các item đã tải vẫn được giữ lại và retry đúng trang
bị lỗi; lỗi không được chuyển thành Empty State.

### 3.4. Trang và component chính

```tsx
// frontend/src/app/orders/page.tsx
'use client';

import { OrderHistory } from '@/components/order-history/OrderHistory';

export default function OrdersPage() {
  return <OrderHistory />;
}
```

```tsx
// frontend/src/components/order-history/OrderHistory.tsx
'use client';

import Link from 'next/link';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { OrderHistoryFilters } from './OrderHistoryFilters';
import { OrderCard } from './OrderCard';
import { OrderHistorySkeleton } from './OrderHistorySkeleton';
import { OrderHistoryEmptyState } from './OrderHistoryEmptyState';
import { OrderHistoryErrorState } from './OrderHistoryErrorState';

export function OrderHistory() {
  const history = useOrderHistory();

  return (
    <main>
      <h1>Lịch sử đơn hàng</h1>
      <OrderHistoryFilters
        value={history.status}
        onChange={history.changeStatus}
      />

      {history.isLoading && <OrderHistorySkeleton />}
      {!history.isLoading && history.error && (
        <OrderHistoryErrorState onRetry={history.retry} />
      )}
      {!history.isLoading &&
        !history.error &&
        history.orders.length === 0 && <OrderHistoryEmptyState />}

      {!history.isLoading && !history.error && history.orders.length > 0 && (
        <section aria-label="Danh sách đơn hàng">
          {history.orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <OrderCard order={order} />
            </Link>
          ))}
          {history.pagination?.hasNextPage && (
            <button
              type="button"
              disabled={history.isLoadingMore}
              onClick={history.loadMore}
            >
              {history.isLoadingMore ? 'Đang tải...' : 'Xem thêm đơn hàng'}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
```

Component phải hiển thị mã đơn, thời gian, trạng thái, tổng tiền và số lượng món
(nếu API trả về). Các trạng thái Loading, Empty, Error và Data được mô tả chi
tiết trong use case; không hiển thị Empty khi request đang lỗi.

---

## 4. KHUNG MÃ NGUỒN BACKEND (BACKEND SKELETON)

### 4.1. DTO query — `backend/src/modules/orders/dto/order-history-query.dto.ts`

```typescript
// backend/src/modules/orders/dto/order-history-query.dto.ts
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class OrderHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
```

Validation query sai phải trả `400 Bad Request`; Backend không truy vấn database
với query không hợp lệ.

### 4.2. Module — `backend/src/modules/orders/orders.module.ts`

```typescript
// backend/src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

### 4.3. Controller — `backend/src/modules/orders/orders.controller.ts`

```typescript
// backend/src/modules/orders/orders.controller.ts
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me')
  getMyOrders(
    @Req() request: AuthenticatedRequest,
    @Query() query: OrderHistoryQueryDto,
  ) {
    return this.ordersService.getOrderHistory(request.user.id, query);
  }

  @Get(':id')
  getOrderDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.ordersService.getOrderDetail(request.user.id, id);
  }
}
```

`JwtAuthGuard` phải chạy trước service. Cả danh sách và chi tiết đều lấy identity
từ request đã xác thực; không dùng `userId` từ query, body hoặc path.

### 4.4. Service — `backend/src/modules/orders/orders.service.ts`

```typescript
// backend/src/modules/orders/orders.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderHistory(userId: string, query: OrderHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [totalItems, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { items: true } } },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    return {
      items: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        totalAmount: Number(order.totalAmount),
        discountAmount: Number(order.discountAmount),
        finalAmount: Number(order.finalAmount),
        itemCount: order._count.items,
      })),
      pagination: {
        page,
        limit,
        total: totalItems,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  }

  async getOrderDetail(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            toppings: {
              include: { topping: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        toppings: item.toppings.map((t) => ({
          id: t.id,
          toppingId: t.toppingId,
          name: t.topping.name,
          price: Number(t.price),
        })),
      })),
    };
  }
}
```

`findFirst({ where: { id, userId } })` giúp ID không tồn tại và ID thuộc user
khác cùng trả `404`, không làm lộ dữ liệu đơn hàng. History chỉ đọc và không
được cập nhật Order, OrderItem, Payment hoặc trạng thái đơn.

### 4.5. Response/error envelope

Response thành công cần có `pagination` ở top-level, bên cạnh `data` là mảng:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0,
    "hasNextPage": false
  },
  "timestamp": "2026-10-09T08:35:00.000Z"
}
```

`TransformInterceptor` hiện tại của skeleton chung bọc toàn bộ giá trị trả về vào
`data`. Vì vậy khi triển khai Order History, cần mở rộng interceptor hoặc dùng
response mapper riêng để giữ đúng shape `data: OrderHistoryItem[]` và
`pagination` ở top-level; không trả dạng `data: { data, pagination }`.

Response lỗi dùng các key `success`, `statusCode`, `error`, `message`,
`timestamp`, `path`. Token không được đưa vào query string hoặc log. Các lỗi
chính gồm `400` cho validation, `401` cho thiếu/sai/hết hạn JWT, `404` cho
Order Detail không tồn tại/không thuộc user và `500` cho lỗi server.

---

## 5. QUY TẮC GIAO DIỆN VÀ KIỂM THỬ TỐI THIỂU

### 5.1. UI states

| State | Điều kiện | Hành vi bắt buộc |
|---|---|---|
| Loading | Đang tải trang đầu hoặc đổi filter | Hiện skeleton, không nháy Empty |
| Loading More | Đang tải trang kế tiếp | Giữ item cũ, chặn request trùng |
| Empty | `200` và `data: []` | Hiện thông báo chưa có đơn; cho phép quay lại menu/xóa filter |
| Error | Network, timeout hoặc `5xx` | Hiện lỗi và Retry; không biến thành Empty |
| Unauthorized | `401` | Yêu cầu đăng nhập lại, không retry vô hạn |
| Data | `200` có item | Hiện item mới nhất trước và cho mở chi tiết |

### 5.2. Integration/E2E checklist

* User A chỉ nhận các Order có `userId` của A; không lộ Order của User B.
* `status`, `page` và `limit` được validate; `limit=51` hoặc `page=0` trả `400`.
* Không có JWT, JWT sai chữ ký hoặc hết hạn trả `401`.
* Kết quả sắp xếp `createdAt DESC`, phân trang không trùng/mất item.
* Trang hợp lệ vượt tổng số trang trả `200` với `data: []`.
* Retry giữ đúng filter/trang; lỗi tải thêm không xóa các item đã có.
* Chọn card dùng đúng `id` trong route `/orders/{id}` và chi tiết lấy dữ liệu
  mới nhất từ Backend.
* ID không tồn tại hoặc thuộc user khác trả cùng `404 Không tìm thấy đơn hàng`.