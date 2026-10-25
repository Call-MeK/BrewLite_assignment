import type { CartItemDraft } from '../types/product';

export function toOrderItems(items: CartItemDraft[]) {
  return items.map(({ productId, size, toppingIds, quantity }) => ({
    productId, size, toppingIds, quantity,
  }));
}
