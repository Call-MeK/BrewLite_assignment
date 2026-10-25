import { fetchApi } from '@/lib/api-client';
import type { CartItemDraft, ProductSize } from '@/types/product';
import { toOrderItems } from '@/lib/order-payload';

export type OrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'PAYMENT_FAILED' | 'CANCELLED';
export type PaymentMethod = 'E_WALLET' | 'BANK_CARD';

export interface OrderSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  finalAmount: number;
  createdAt: string;
  itemCount: number;
}

export interface OrderDetail extends Omit<OrderSummary, 'itemCount'> {
  totalAmount: number;
  discountAmount: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  items: {
    id: string;
    name: string;
    size: ProductSize;
    quantity: number;
    lineTotal: number;
    toppings: { id: string; name: string }[];
  }[];
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng nhận', COMPLETED: 'Hoàn thành', PAYMENT_FAILED: 'Thanh toán thất bại', CANCELLED: 'Đã hủy',
};

export function createOrder(items: CartItemDraft[], pointsToUse = 0) {
  return fetchApi<{ id: string }>('/orders', {
    method: 'POST', body: JSON.stringify({ items: toOrderItems(items), pointsToUse }),
  });
}

export function getOrders(page: number) {
  return fetchApi<{ items: OrderSummary[]; pagination: { hasNextPage: boolean } }>(`/orders/me?page=${page}&limit=10`);
}

export function getOrder(id: string) {
  return fetchApi<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
}

export function cancelOrder(id: string) {
  return fetchApi<{ status: OrderStatus }>(`/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export function payOrder(id: string, method: PaymentMethod, key: string, outcome: 'SUCCESS' | 'FAILED') {
  return fetchApi<{ status: 'SUCCESS' | 'FAILED'; failureReason: string | null }>('/payments', {
    method: 'POST',
    headers: { 'Idempotency-Key': key, 'X-Mock-Outcome': outcome },
    body: JSON.stringify({ orderId: id, method }),
  });
}
