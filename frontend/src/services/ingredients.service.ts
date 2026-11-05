import { fetchApi } from '@/lib/api-client';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  price: number;
}

export const ingredientsService = {
  getAll: () => fetchApi<Ingredient[]>('/ingredients', { cache: 'no-store' }),
  create: (data: { name: string; unit: string; stock: number; price: number }) => fetchApi<Ingredient>('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; unit?: string; stock?: number; price?: number }) => fetchApi<Ingredient>(`/ingredients/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<Ingredient>(`/ingredients/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
