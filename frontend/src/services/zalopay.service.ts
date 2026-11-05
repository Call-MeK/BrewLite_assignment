import { fetchApi } from '@/lib/api-client';
import type { PaymentMethod } from './order.service';

export interface ZaloPayPayment {
  id: string;
  orderId: string;
  source: 'ZALOPAY_SANDBOX';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  method: PaymentMethod;
  amount: number;
  paymentUrl: string | null;
  providerOrderId: string;
  reference: string | null;
  providerAmount: number | null;
  reviewReason: string | null;
  failureReason: string | null;
  expiresAt: string;
  createdAt: string;
}

export function getZaloPayConfig(signal?: AbortSignal) {
  return fetchApi<{ enabled: boolean }>('/payments/zalopay/config', { signal, cache: 'no-store' });
}

export function getLatestZaloPay(orderId: string, signal?: AbortSignal) {
  return fetchApi<ZaloPayPayment | null>(`/payments/zalopay/orders/${encodeURIComponent(orderId)}`, { signal, cache: 'no-store' });
}

export function createZaloPay(orderId: string, method: PaymentMethod, key: string) {
  return fetchApi<ZaloPayPayment>('/payments/zalopay', {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ orderId, method }), cache: 'no-store',
  });
}

export function syncZaloPay(id: string, signal?: AbortSignal) {
  return fetchApi<ZaloPayPayment>(`/payments/zalopay/${encodeURIComponent(id)}/sync`, { method: 'POST', signal, cache: 'no-store' });
}

export function cancelZaloPay(id: string, signal?: AbortSignal) {
  return fetchApi<ZaloPayPayment>(`/payments/zalopay/${encodeURIComponent(id)}/cancel`, { method: 'POST', signal, cache: 'no-store' });
}
