"use client";

import { useEffect, useState } from "react";
import { ingredientsService, Ingredient } from "@/services/ingredients.service";

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  // State cho Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    stock: 0,
    unit: "",
    price: 0,
  });

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    try {
      const data = await ingredientsService.getAll();
      setIngredients(data);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa nguyên liệu này?")) return;
    try {
      await ingredientsService.delete(id);
      setIngredients(ingredients.filter((item) => item.id !== id));
    } catch (error) {
      alert("Không thể xóa nguyên liệu lúc này.");
    }
  };

  const openModal = (ingredient?: Ingredient) => {
    if (ingredient) {
      setEditingId(ingredient.id);
      setFormData({
        name: ingredient.name,
        stock: ingredient.stock,
        unit: ingredient.unit,
        price: ingredient.price,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", stock: 0, unit: "", price: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await ingredientsService.update(editingId, formData);
      } else {
        await ingredientsService.create(formData);
      }
      setIsModalOpen(false);
      loadIngredients(); // Tải lại danh sách sau khi lưu
    } catch (error) {
      alert("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
    }
  };

  if (loading) return <div className="p-6">Đang tải dữ liệu kho...</div>;

  return (
    <div className="p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quản lý Kho Nguyên liệu</h1>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          + Thêm nguyên liệu
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-700">Tên nguyên liệu</th>
              <th className="p-4 font-medium text-gray-700">
                Tồn kho hiện tại
              </th>
              <th className="p-4 font-medium text-gray-700">Đơn vị đo</th>
              <th className="p-4">Giá vốn</th>
              <th className="p-4 font-medium text-gray-700 text-right">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ingredients.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{item.name}</td>
                <td className="p-4 font-semibold text-blue-600">
                  {item.stock.toLocaleString()}
                </td>
                <td className="p-4 text-gray-500">{item.unit}</td>
                <td className="p-4 font-bold text-amber-600">
                  {item.price?.toLocaleString() || 0} đ / {item.unit}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => openModal(item)}
                    className="text-blue-500 hover:text-blue-700 font-medium mr-4"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-700 font-medium"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Sửa nguyên liệu" : "Thêm nguyên liệu mới"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Tên nguyên liệu
                </label>
                <input
                  required
                  type="text"
                  className="w-full border p-2 rounded"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Số lượng tồn (ban đầu)
                </label>
                <input
                  required
                  type="number"
                  className="w-full border p-2 rounded"
                  min="0"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: Number(e.target.value) })
                  }
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Đơn vị tính (VD: gram, ml)
                </label>
                <select required className="w-full border p-2 rounded" value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="">--</option>
                  <option value="G">g</option>
                  <option value="ML">ml</option>
                  <option value="PIECE">piece</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Giá vốn trên 1 đơn vị (VNĐ)
                </label>
                <input
                  required
                  type="number"
                  className="w-full border p-2.5 rounded-xl bg-white"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: Number(e.target.value) })
                  }
                  placeholder="VD: 500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
