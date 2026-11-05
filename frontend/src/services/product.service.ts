import { fetchApi } from "@/lib/api-client";
import type { ProductDetail, ProductSummary } from "@/types/product";
import type { ProductSize } from '@/types/product';

export type SizeAdjustment = { size: ProductSize; priceAdjustment: number };

export function getSizePrices(id: string) {
  return fetchApi<SizeAdjustment[]>(`/products/${encodeURIComponent(id)}/size-prices`, { cache: 'no-store' });
}

export function updateSizePrices(id: string, sizes: SizeAdjustment[]) {
  return fetchApi<SizeAdjustment[]>(`/products/${encodeURIComponent(id)}/size-prices`, { method: 'PUT', body: JSON.stringify({ sizes }) });
}

export async function getProducts(): Promise<ProductSummary[]> {
  return fetchApi<ProductSummary[]>("/products");
}

export async function getProductById(id: string): Promise<ProductDetail> {
  return fetchApi<ProductDetail>(`/products/${encodeURIComponent(id)}`);
}
export async function getAllProducts() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/products`
    : "http://localhost:4000/api/v1/products";

  // Lấy token giống như cách đã làm bên ingredients
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";

  const res = await fetch(API_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Đính kèm Token vào request
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Lỗi tải sản phẩm từ Backend:", res.status, errorText);
    throw new Error("Không thể tải danh sách sản phẩm");
  }

  const json = await res.json();
  // Trả về mảng dữ liệu (đảm bảo backend của bạn bọc dữ liệu trong json.data)
  return json.data;
}
export async function getAllCategories() {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";

  const res = await fetch(`${API_URL}/categories`, {
    // Đảm bảo backend bạn có API GET /categories
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Không thể tải danh sách danh mục");
  const json = await res.json();
  return json.data || json;
}
export async function createProduct(data: any) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"}/products`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error("Lỗi tạo sản phẩm");
  return (await res.json()).data;
}

export async function deleteProduct(id: string) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"}/products/${id}`,
    {
      method: "DELETE",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    },
  );
  if (!res.ok) throw new Error("Lỗi xóa sản phẩm");
}
// --- API CHO CÔNG THỨC (RECIPE) ---

export async function getProductRecipe(productId: string) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";
  const res = await fetch(`${API_URL}/products/${productId}/recipe`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Lỗi lấy công thức");
  const json = await res.json();
  return json.data;
}

export async function addRecipeItem(
  productId: string,
  ingredientId: string,
  quantity: number,
) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";
  const res = await fetch(`${API_URL}/products/${productId}/recipe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ingredientId, quantity }),
  });
  if (!res.ok) throw new Error("Lỗi thêm nguyên liệu");
  const json = await res.json();
  return json.data;
}

export async function removeRecipeItem(
  productId: string,
  ingredientId: string,
) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : "";
  const res = await fetch(
    `${API_URL}/products/${productId}/recipe/${ingredientId}`,
    {
      method: "DELETE",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    },
  );
  if (!res.ok) throw new Error("Lỗi xóa nguyên liệu");
}
