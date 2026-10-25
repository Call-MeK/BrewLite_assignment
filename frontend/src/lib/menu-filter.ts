import type { ProductSummary } from '../types/product';

export function filterMenu(products: ProductSummary[], keyword: string, category: string) {
  const search = keyword.trim().toLocaleLowerCase('vi');
  return products.filter((product) =>
    (!category || product.categoryName === category) &&
    product.name.toLocaleLowerCase('vi').includes(search),
  );
}
