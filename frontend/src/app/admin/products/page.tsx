"use client";

import { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import {
  getAllProducts,
  createProduct,
  getAllCategories,
  getProductRecipe,
  addRecipeItem,
  removeRecipeItem,
} from "@/services/product.service";
import { ingredientsService } from "@/services/ingredients.service";

const smallButton = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-ticket border border-ink/25 bg-white px-3 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    basePrice: 0,
  });

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [recipeItems, setRecipeItems] = useState<any[]>([]);

  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadIngredients();
  }, []);

  const loadProducts = async () => {
    try {
      setProducts(await getAllProducts());
    } catch (error) {
      console.error(error);
    }
  };
  const loadCategories = async () => {
    try {
      setCategories(await getAllCategories());
    } catch (error) {
      console.error(error);
    }
  };
  const loadIngredients = async () => {
    try {
      setIngredients(await ingredientsService.getAll());
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct({
        name: formData.name,
        categorySlug: formData.category,
        basePrice: formData.basePrice,
        isAvailable: true,
      });
      setIsModalOpen(false);
      setFormData({ name: "", category: "", basePrice: 0 });
      loadProducts();
    } catch (error) {
      alert("Không thể lưu sản phẩm.");
    }
  };

  const openRecipeModal = async (product: any) => {
    setSelectedProduct(product);
    setIsRecipeModalOpen(true);
    setRecipeItems([]);
    try {
      const data = await getProductRecipe(product.id);
      if (Array.isArray(data)) {
        setRecipeItems(data);
      } else if (data && Array.isArray(data.data)) {
        setRecipeItems(data.data);
      } else {
        setRecipeItems([]);
      }
    } catch (error) {
      console.error("Lỗi tải công thức", error);
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedIngredientId || !quantity)
      return alert("Vui lòng chọn nguyên liệu và nhập số lượng");
    try {
      await addRecipeItem(selectedProduct.id, selectedIngredientId, Number(quantity));
      const data = await getProductRecipe(selectedProduct.id);
      if (Array.isArray(data)) {
        setRecipeItems(data);
      } else if (data && Array.isArray(data.data)) {
        setRecipeItems(data.data);
      } else {
        setRecipeItems([]);
      }
      setQuantity("");
      setSelectedIngredientId("");
    } catch (error) {
      alert("Lỗi thêm nguyên liệu");
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này? Toàn bộ công thức đi kèm cũng sẽ bị xóa.")) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const res = await fetch(`${API_URL}/products/${id}`, { method: "DELETE" });

      if (res.ok) {
        setProducts(products.filter((item) => item.id !== id));
      } else {
        alert("Có lỗi xảy ra khi xóa sản phẩm.");
      }
    } catch (error) {
      console.error("Lỗi xóa sản phẩm:", error);
    }
  };
  const handleDeleteRecipe = async (ingredientId: string) => {
    try {
      await removeRecipeItem(selectedProduct.id, ingredientId);
      setRecipeItems(recipeItems.filter((item) => item.ingredientId !== ingredientId));
    } catch (error) {
      alert("Lỗi xóa nguyên liệu");
    }
  };

  const cost = recipeItems.reduce((sum, item) => sum + item.quantity * (Number(item.ingredient?.price) || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <p className="kicker">Sổ quản trị · Thực đơn</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Quản lý sản phẩm</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Thêm món mới và thiết lập công thức định lượng cho từng sản phẩm.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary min-h-11 px-4 text-white">
          <Plus size={18} aria-hidden="true" /> Thêm món mới
        </button>
      </header>

      <div className="ticket overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink/15 bg-paper-deep/50 text-[11px] uppercase tracking-[0.14em] text-content-secondary">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Tên sản phẩm</th>
                <th scope="col" className="px-5 py-3 font-semibold">Danh mục</th>
                <th scope="col" className="px-5 py-3 font-semibold">Giá gốc</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {products.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-paper/60">
                  <td className="px-5 py-4 font-semibold text-ink">{item.name}</td>
                  <td className="px-5 py-4 text-content-secondary">{item.category?.name || item.categoryName || "---"}</td>
                  <td className="price whitespace-nowrap px-5 py-4 font-semibold">{item.basePrice?.toLocaleString("vi-VN")} ₫</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openRecipeModal(item)} className={smallButton} title="Cài đặt công thức">
                        <BookOpen size={15} aria-hidden="true" /> Công thức
                      </button>
                      <button onClick={() => handleDelete(item.id)} aria-label={`Xóa ${item.name}`} className={`${smallButton} px-2.5 text-danger hover:border-danger`}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-content-secondary">Chưa có sản phẩm trong thực đơn.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-5 py-3 text-xs text-content-secondary">
          <span>Tổng cộng</span>
          <span className="font-semibold text-ink">{products.length} sản phẩm</span>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="new-product-title">
          <div className="ticket w-full max-w-md p-6">
            <div className="border-b border-dashed border-ink/25 pb-4">
              <p className="kicker">Thực đơn</p>
              <h2 id="new-product-title" className="mt-1 text-xl font-bold text-ink">Thêm sản phẩm mới</h2>
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-content-secondary">Tên món
                <input required type="text" className="field mt-2" onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-content-secondary">Danh mục
                <select required className="field mt-2" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  <option value="" disabled>Chọn danh mục</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.slug}>{cat.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-content-secondary">Giá gốc (VNĐ)
                <input required type="number" min="0" className="field mt-2" onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })} />
              </label>
              <div className="flex justify-end gap-2 border-t border-dashed border-ink/25 pt-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex min-h-11 items-center rounded-ticket px-4 text-sm font-semibold text-content-secondary hover:bg-paper">Hủy</button>
                <button type="submit" className="btn-primary min-h-11 px-4 text-white">Lưu sản phẩm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
          <div className="ticket flex max-h-[90vh] w-full max-w-2xl flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/25 p-6">
              <div>
                <p className="kicker">Định lượng</p>
                <h2 id="recipe-title" className="mt-1 text-xl font-bold text-ink">Công thức sản phẩm</h2>
                <p className="mt-1 text-sm font-medium text-primary">{selectedProduct?.name}</p>
              </div>
              <button onClick={() => setIsRecipeModalOpen(false)} aria-label="Đóng" className="rounded-ticket border border-ink/20 p-2 text-content-secondary hover:border-ink hover:text-ink">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="flex flex-wrap items-end gap-3 rounded-ticket border border-ink/15 bg-paper-deep/40 p-4">
                <label className="min-w-40 flex-1 text-xs font-semibold text-content-secondary">Chọn nguyên liệu
                  <select className="field mt-2" value={selectedIngredientId} onChange={(e) => setSelectedIngredientId(e.target.value)}>
                    <option value="">Chọn nguyên liệu</option>
                    {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                  </select>
                </label>
                <label className="w-28 text-xs font-semibold text-content-secondary">Định lượng
                  <input type="number" min="0.1" step="0.1" className="field mt-2" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="VD: 20" />
                </label>
                <button onClick={handleAddRecipe} className="btn-primary min-h-12 px-4 text-white">Thêm</button>
              </div>

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-content-secondary">Thành phần hiện tại</h3>
              <div className="mt-3 overflow-hidden rounded-ticket border border-ink/15">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink/15 bg-paper-deep/50 text-[11px] uppercase tracking-[0.12em] text-content-secondary">
                    <tr><th scope="col" className="px-3 py-2.5 font-semibold">Nguyên liệu</th><th scope="col" className="px-3 py-2.5 font-semibold">Định lượng</th><th scope="col" className="px-3 py-2.5 text-right font-semibold">Xóa</th></tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {recipeItems.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-8 text-center text-content-secondary">Chưa có nguyên liệu nào.</td></tr>
                    ) : recipeItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 font-medium text-ink">{item.ingredient?.name}</td>
                        <td className="price px-3 py-3 font-semibold text-primary">{item.quantity} {item.ingredient?.unit}</td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => handleDeleteRecipe(item.ingredientId)} aria-label={`Xóa ${item.ingredient?.name}`} className="rounded-ticket p-1.5 text-danger hover:bg-danger-light">
                            <X size={15} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {recipeItems.length > 0 && (
                    <tfoot className="border-t border-ink/15 bg-paper-deep/40">
                      <tr>
                        <td colSpan={2} className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-content-secondary">Tổng giá vốn (COGS)</td>
                        <td className="price px-3 py-3 text-right text-lg font-bold text-danger">{cost.toLocaleString("vi-VN")} ₫</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
