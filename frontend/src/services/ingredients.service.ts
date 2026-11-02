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

// Đường dẫn trỏ tới Backend đang chạy ở cổng 4000
const API_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/ingredients`
  : "http://localhost:4000/api/v1/ingredients";

export const ingredientsService = {
  // 1. Lấy danh sách nguyên liệu

  async getAll(): Promise<Ingredient[]> {
    // Tìm token (tùy vào cách dự án của bạn lưu chữ 'accessToken' hay 'token')
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken") || localStorage.getItem("token")
        : "";

    const res = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Đính kèm token y hệt như cách bạn làm trên Postman
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Chi tiết lỗi từ Backend:", res.status, errorText);
      throw new Error("Lỗi khi tải danh sách nguyên liệu");
    }

    const json = await res.json();
    return json.data;
  },

  // 2. Thêm nguyên liệu mới
  async create(data: {
    name: string;
    unit: string;
    stock: number;
  }): Promise<Ingredient> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Lỗi khi thêm nguyên liệu");
    const json = await res.json();
    return json.data;
  },

  // 3. Cập nhật tồn kho hoặc thông tin
  async update(
    id: string,
    data: { name?: string; unit?: string; stock?: number },
  ): Promise<Ingredient> {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Lỗi khi cập nhật nguyên liệu");
    const json = await res.json();
    return json.data;
  },

  // 4. Xóa nguyên liệu
  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Lỗi khi xóa nguyên liệu");
  },
};
