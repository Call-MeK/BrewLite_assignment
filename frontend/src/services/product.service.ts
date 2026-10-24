import { fetchApi } from '@/lib/api-client';
import type { ProductDetail, ProductSummary } from '@/types/product';

export async function getProducts(): Promise<ProductSummary[]> {
  return fetchApi<ProductSummary[]>('/products');
}

export async function getProductById(id: string): Promise<ProductDetail> {
  return fetchApi<ProductDetail>(`/products/${encodeURIComponent(id)}`);
}
