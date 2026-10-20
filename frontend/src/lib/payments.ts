import { fetchApi } from './api-client';

export type PaymentMethod = 'E_WALLET' | 'BANK_CARD';
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  transactionRef: string | null;
  paymentUrl: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface PaymentOrder {
  id: string;
  orderNumber: number;
  finalAmount: number;
  status: string;
  payment: Payment | null;
}

export const getPaymentOrder = (orderId: string) =>
  fetchApi<PaymentOrder>(`/payments/orders/${encodeURIComponent(orderId)}`);

export const getPayment = (id: string) =>
  fetchApi<Payment>(`/payments/${encodeURIComponent(id)}`);

export const createPayment = (orderId: string, method: PaymentMethod, key: string) =>
  fetchApi<Payment>('/payments', {
    method: 'POST', headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ orderId, method }),
  });

export function getPaymentAttemptKey(storage: Pick<Storage, 'getItem' | 'setItem'>, orderId: string, retry: boolean): string {
  const name = `brewlite_payment_key:${orderId}`;
  let key = retry ? null : storage.getItem(name);
  if (!key) {
    key = crypto.randomUUID();
    storage.setItem(name, key);
  }
  return key;
}

export function clearPaidCart(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  payment: Pick<Payment, 'orderId' | 'status'>,
): boolean {
  if (payment.status !== 'SUCCESS') return false;
  try {
    // shortcut: Cart store is not implemented yet; use its documented persist format until it is available.
    const cart = JSON.parse(storage.getItem('brewlite_cart_storage') ?? 'null');
    if (!cart?.state || cart.state.pendingOrderId !== payment.orderId) return false;
    storage.setItem('brewlite_cart_storage', JSON.stringify({
      ...cart,
      state: { ...cart.state, items: [], totalAmount: 0, badgeCount: 0, pendingOrderId: null },
    }));
    return true;
  } catch {
    return false;
  }
}
