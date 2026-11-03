import type { CartItemDraft } from '@/types/product';

const keys = {
  id: 'brewlite-pending-order-id',
  userId: 'brewlite-pending-order-user-id',
  cart: 'brewlite-pending-order-cart',
  savedCart: 'brewlite-cart',
} as const;

type OrderState = { id: string; status: string };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function savePendingOrder(storage: StorageLike, orderId: string, userId: string, cart: string) {
  storage.setItem(keys.id, orderId);
  storage.setItem(keys.userId, userId);
  storage.setItem(keys.cart, cart);
}

export function clearPendingOrder(storage: StorageLike, orderId: string) {
  if (storage.getItem(keys.id) !== orderId) return false;
  storage.removeItem(keys.id);
  storage.removeItem(keys.userId);
  storage.removeItem(keys.cart);
  return true;
}

export function finishPaidPendingOrder(storage: StorageLike, orderId: string) {
  if (storage.getItem(keys.id) !== orderId) return false;
  const sameCart = storage.getItem(keys.cart) !== null && storage.getItem(keys.cart) === (storage.getItem(keys.savedCart) || '[]');
  if (sameCart) storage.removeItem(keys.savedCart);
  clearPendingOrder(storage, orderId);
  return sameCart;
}

export async function reconcilePendingOrder(
  storage: StorageLike,
  userId: string,
  getOrder: (id: string) => Promise<OrderState>,
  cancelOrder: (id: string) => Promise<unknown>,
  replaceEditedCart = false,
) {
  const id = storage.getItem(keys.id);
  if (!id) return null;
  if (!userId || storage.getItem(keys.userId) !== userId) {
    clearPendingOrder(storage, id);
    return null;
  }

  const current = await getOrder(id).catch((cause: { statusCode?: number }) => {
    if (cause?.statusCode !== 404) throw cause;
    return null;
  });
  if (!current) {
    clearPendingOrder(storage, id);
    return null;
  }
  const cancellable = current.status === 'PENDING' || current.status === 'PAYMENT_FAILED';
  if (!cancellable) {
    if (current.status === 'PAID') finishPaidPendingOrder(storage, id);
    else clearPendingOrder(storage, id);
    return null;
  }
  if (storage.getItem(keys.cart) === (storage.getItem(keys.savedCart) || '[]')) return current;
  if (!replaceEditedCart) return null;

  try {
    await cancelOrder(id);
  } catch (cause) {
    if ((cause as { statusCode?: number })?.statusCode !== 409) throw cause;
    const latest = await getOrder(id).catch((error: { statusCode?: number }) => {
      if (error?.statusCode !== 404) throw error;
      return null;
    });
    if (latest?.status === 'PENDING' || latest?.status === 'PAYMENT_FAILED') throw cause;
  }
  clearPendingOrder(storage, id);
  return null;
}
export async function submitCheckoutOrder(
  storage: StorageLike,
  userId: string,
  getOrder: (id: string) => Promise<OrderState>,
  cancelOrder: (id: string) => Promise<unknown>,
  createOrder: (items: CartItemDraft[], pointsToUse: number) => Promise<{ id: string }>,
  pointsToUse: number,
  availablePoints: number,
) {
  const pending = await reconcilePendingOrder(storage, userId, getOrder, cancelOrder, true);
  if (pending) return { type: 'resume' as const, order: pending };

  const cartJson = storage.getItem(keys.savedCart) || '[]';
  const items: CartItemDraft[] = JSON.parse(cartJson);
  if (!Array.isArray(items) || items.length === 0) return { type: 'empty' as const };
  const total = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);
  const maxPoints = Math.max(0, Math.min(Math.floor(availablePoints / 10) * 10, Math.floor(total / 1000) * 10));
  if (!Number.isSafeInteger(pointsToUse) || pointsToUse < 0 || pointsToUse % 10 !== 0 || pointsToUse > maxPoints) {
    return { type: 'invalid-points' as const, items };
  }

  const order = await createOrder(items, pointsToUse);
  savePendingOrder(storage, order.id, userId, cartJson);
  return { type: 'created' as const, order };
}
