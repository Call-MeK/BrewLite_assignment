import { fetchApi } from '@/lib/api-client';
import type { ProductSize } from '@/types/product';

export type IngredientUnit = 'G' | 'ML' | 'PIECE';
export const unitLabels: Record<IngredientUnit, string> = { G: 'g', ML: 'ml', PIECE: 'cái' };
export interface Ingredient { id: string; name: string; unit: IngredientUnit; recipeCount: number }
export interface RecipeCatalog {
  products: { id: string; name: string; sizes: { size: ProductSize; ingredientCount: number }[] }[];
  ingredients: Ingredient[];
}
export interface Recipe { productId: string; size: ProductSize; items: { ingredientId: string; name: string; unit: IngredientUnit; quantity: number }[] }
export function getRecipeCatalog(signal?: AbortSignal) { return fetchApi<RecipeCatalog>('/admin/recipes/catalog', { signal, cache: 'no-store' }); }
export function getRecipe(productId: string, size: ProductSize, signal?: AbortSignal) { return fetchApi<Recipe>(`/admin/recipes/${encodeURIComponent(productId)}/${size}`, { signal, cache: 'no-store' }); }
export function saveRecipe(productId: string, size: ProductSize, items: { ingredientId: string; quantity: number }[]) {
  return fetchApi<Recipe>(`/admin/recipes/${encodeURIComponent(productId)}/${size}`, { method: 'PUT', body: JSON.stringify({ items }), cache: 'no-store' });
}
export function saveIngredient(id: string, name: string, unit: IngredientUnit) {
  return fetchApi<Ingredient>(`/admin/recipes/ingredients${id ? '/' + encodeURIComponent(id) : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ name, unit }) });
}
export function deleteIngredient(id: string) { return fetchApi<{ id: string }>(`/admin/recipes/ingredients/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
