import { fetchApi } from '@/lib/api-client';
import type { OrderDetail, OrderStatus, OrderSummary } from '@/services/order.service';

type Customer = { id: string; email: string; fullName: string | null };
type RefundStatus = 'NONE' | 'MANUAL_REQUIRED';
export type AdminOrder = OrderSummary & { customer: Customer; refundStatus: RefundStatus };
export type AdminOrderDetail = OrderDetail & {
  customer: Customer;
  refundStatus: RefundStatus;
  payments: { id: string; source: string; status: string; amount: number; createdAt: string; reviewReason: string | null }[];
  statusHistory: { fromStatus: OrderStatus | null; toStatus: OrderStatus; changedBy: string | null; reason: string | null; createdAt: string }[];
};
export function getAdminOrders(page: number, status: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) query.set('status', status);
  return fetchApi<{ items: AdminOrder[]; pagination: { total: number; hasNextPage: boolean } }>(`/admin/orders?${query}`, { signal });
}
export function getAdminOrder(id: string, signal?: AbortSignal) {
  return fetchApi<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`, { signal });
}
export function advanceAdminOrder(id: string, status: 'PREPARING' | 'READY' | 'COMPLETED') {
  return fetchApi(`/admin/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
export function cancelAdminOrder(id: string) {
  return fetchApi(`/admin/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}
