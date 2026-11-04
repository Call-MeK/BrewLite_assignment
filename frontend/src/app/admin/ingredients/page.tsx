"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { ingredientsService, Ingredient } from "@/services/ingredients.service";

const smallButton = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-ticket border border-ink/25 bg-white px-3 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", stock: 0, unit: "", price: 0 });

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    try {
      setIngredients(await ingredientsService.getAll());
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
      setFormData({ name: ingredient.name, stock: ingredient.stock, unit: ingredient.unit, price: ingredient.price });
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
      loadIngredients();
    } catch (error) {
      alert("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <p className="kicker">Sổ quản trị · Kho</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Nguyên liệu</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Theo dõi tồn kho và giá vốn để giữ công thức luôn chính xác.</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary min-h-11 px-4 text-white">
          <Plus size={18} aria-hidden="true" /> Thêm nguyên liệu
        </button>
      </header>

      <div className="ticket overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-ink/15 bg-paper-deep/50 text-[11px] uppercase tracking-[0.14em] text-content-secondary">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Tên nguyên liệu</th>
                <th scope="col" className="px-5 py-3 font-semibold">Tồn kho</th>
                <th scope="col" className="px-5 py-3 font-semibold">Đơn vị</th>
                <th scope="col" className="px-5 py-3 font-semibold">Giá vốn</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {ingredients.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-paper/60">
                  <td className="px-5 py-4 font-semibold text-ink">{item.name}</td>
                  <td className="px-5 py-4">
                    <span className={`price inline-flex items-center gap-1.5 rounded-ticket px-2.5 py-1 text-xs font-bold ${item.stock <= 0 ? "bg-danger-light text-danger" : "bg-surface-secondary text-ink"}`}>
                      {item.stock <= 0 && <CircleAlert size={13} aria-hidden="true" />}
                      {item.stock.toLocaleString("vi-VN")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-content-secondary">{item.unit}</td>
                  <td className="price px-5 py-4 font-semibold text-primary">{item.price?.toLocaleString("vi-VN") || 0} đ / {item.unit}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(item)} className={smallButton}><Pencil size={14} aria-hidden="true" /> Sửa</button>
                      <button onClick={() => handleDelete(item.id)} className={`${smallButton} px-2.5 text-danger hover:border-danger`} aria-label={`Xóa ${item.name}`}><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {ingredients.length === 0 && (
                <tr><td colSpan={5} role="status" className="px-5 py-12 text-center text-content-secondary">{loading ? "Đang tải dữ liệu kho..." : "Chưa có nguyên liệu nào."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-5 py-3 text-xs text-content-secondary">
          <span>Tổng cộng</span>
          <span className="font-semibold text-ink">{ingredients.length} nguyên liệu</span>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ingredient-title">
          <div className="ticket w-full max-w-md p-6">
            <div className="border-b border-dashed border-ink/25 pb-4">
              <p className="kicker">Kho nguyên liệu</p>
              <h2 id="ingredient-title" className="mt-1 text-xl font-bold text-ink">{editingId ? "Sửa nguyên liệu" : "Thêm nguyên liệu mới"}</h2>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-content-secondary">Tên nguyên liệu
                <input required type="text" className="field mt-2" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-content-secondary">Số lượng tồn
                <input required type="number" min="0" className="field mt-2" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} />
              </label>
              <label className="block text-xs font-semibold text-content-secondary">Đơn vị tính
                <select required className="field mt-2" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="">Chọn đơn vị</option>
                  <option value="G">g</option>
                  <option value="ML">ml</option>
                  <option value="PIECE">piece</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-content-secondary">Giá vốn trên 1 đơn vị (VNĐ)
                <input required type="number" min="0" className="field mt-2" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} placeholder="VD: 500" />
              </label>
              <div className="flex justify-end gap-2 border-t border-dashed border-ink/25 pt-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex min-h-11 items-center rounded-ticket px-4 text-sm font-semibold text-content-secondary hover:bg-paper">Hủy</button>
                <button type="submit" className="btn-primary min-h-11 px-4 text-white">Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
