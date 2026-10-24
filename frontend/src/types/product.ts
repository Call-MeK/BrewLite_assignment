export type ProductSize = 'S' | 'M' | 'L';

export interface ProductSizePrice {
  size: ProductSize;
  priceAdjustment: number;
}

export interface ProductTopping {
  id: string;
  name: string;
  price: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  currency: 'VND' | string;
  isAvailable: boolean;
  sizePrices: ProductSizePrice[];
  toppings: ProductTopping[];
}

export interface ProductSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  isAvailable: boolean;
  categoryName?: string | null;
  sizePrices?: ProductSizePrice[];
}

export interface CartItemDraft {
  productId: string;
  productName: string;
  imageUrl: string | null;
  size: ProductSize;
  toppingIds: string[];
  toppingNames: string[];
  quantity: number;
  estimatedUnitPrice: number;
  currency: string;
}
