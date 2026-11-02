import { fetchApi } from '@/lib/api-client';
import type { ManagedPayment, PaymentFilters, PaymentManagementResult } from '@/types/payment-management';

export function getManagedPayments(filters: PaymentFilters, page: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(page), limit: '6', source: filters.source, status: filters.status });
  for (const key of ['search', 'from', 'to'] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  return fetchApi<PaymentManagementResult>(`/admin/payments?${query}`, { signal, cache: 'no-store' });
}

export function getManagedPayment(id: string, signal?: AbortSignal) {
  return fetchApi<ManagedPayment>(`/admin/payments/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
}
