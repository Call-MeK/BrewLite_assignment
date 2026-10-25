import type { CartItemDraft } from '../types/product';

export function addOrMergeCartItem(items: CartItemDraft[], item: CartItemDraft): CartItemDraft[] {
  const index = items.findIndex((saved) =>
    saved.productId === item.productId &&
    saved.size === item.size &&
    [...saved.toppingIds].sort().join(',') === [...item.toppingIds].sort().join(','),
  );
  if (index === -1) return [...items, item];
  if (items[index].quantity + item.quantity > 99) {
    throw new Error('Mỗi món chỉ được tối đa 99 ly.');
  }
  return items.map((saved, position) => position === index
    ? { ...saved, quantity: saved.quantity + item.quantity }
    : saved);
}

export function replaceCartItem(items: CartItemDraft[], index: number, item: CartItemDraft): CartItemDraft[] {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new Error('Món cần sửa không còn trong danh sách. Vui lòng tải lại trang.');
  }
  return addOrMergeCartItem(items.filter((_, position) => position !== index), item);
}
