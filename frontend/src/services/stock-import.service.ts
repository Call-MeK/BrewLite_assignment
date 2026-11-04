import { fetchApi } from '@/lib/api-client';

export type IngredientUnit = 'G' | 'ML' | 'PIECE';

export const stockUnitLabels: Record<IngredientUnit, string> = {
  G: 'g',
  ML: 'ml',
  PIECE: 'cái',
};

export interface StockImportSummary {
  id: string;
  importNumber: number;
  supplier: string | null;
  note: string | null;
  totalAmount: number;
  createdBy: string | null;
  createdAt: string;
  itemCount: number;
}

export interface StockImportList {
  items: StockImportSummary[];
  summary: { count: number; totalValue: number };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface StockImportItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  ingredient: { name: string; unit: IngredientUnit; stock: number };
}

export interface StockImportDetail {
  id: string;
  importNumber: number;
  supplier: string | null;
  note: string | null;
  totalAmount: number;
  createdBy: string | null;
  createdAt: string;
  items: StockImportItem[];
}

export interface CreateStockImportPayload {
  supplier?: string;
  note?: string;
  items: { ingredientId: string; quantity: number; unitPrice: number }[];
}

export function listStockImports(page = 1, pageSize = 10) {
  return fetchApi<StockImportList>(`/admin/stock-imports?page=${page}&pageSize=${pageSize}`, { cache: 'no-store' });
}

export function getStockImport(id: string, signal?: AbortSignal) {
  return fetchApi<StockImportDetail>(`/admin/stock-imports/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
}

export function createStockImport(payload: CreateStockImportPayload) {
  return fetchApi<StockImportDetail>('/admin/stock-imports', {
    method: 'POST',
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
}
