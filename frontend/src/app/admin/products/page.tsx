"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import {
  getAllProducts,
  createProduct,
  deleteProduct,
  getAllCategories,
  getProductRecipe,
  addRecipeItem,
  removeRecipeItem,
} from "@/services/product.service";
import { ingredientsService } from "@/services/ingredients.service";
import { getSizePrices, updateSizePrices, type SizeAdjustment } from '@/services/product.service';

const smallButton = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-ticket border border-ink/25 bg-white px-3 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [priceProduct, setPriceProduct] = useState<{ id: string; name: string; basePrice: number } | null>(null);
  const [sizePrices, setSizePrices] = useState<{ size: SizeAdjustment['size']; priceAdjustment: string }[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [priceNotice, setPriceNotice] = useState('');

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

  async function editPrices(product: { id: string; name: string; basePrice: number }) {
    setPriceProduct(product);
    setSizePrices([]);
    setPriceNotice('');
    setPriceError('');
    setPriceLoading(true);
    try { setSizePrices((await getSizePrices(product.id)).map((item) => ({ ...item, priceAdjustment: String(item.priceAdjustment) }))); }
    catch (error) { setPriceError(error instanceof Error ? error.message : 'Không tải được phụ thu.'); }
    finally { setPriceLoading(false); }
  }

  async function savePrices(event: React.FormEvent) {
    event.preventDefault();
    if (!priceProduct || priceLoading || !sizePrices.length) return;
    setPriceLoading(true);
    setPriceError('');
    setPriceNotice('');
    try {
      const saved = await updateSizePrices(priceProduct.id, sizePrices.map((item) => ({ ...item, priceAdjustment: Number(item.priceAdjustment) })));
      setSizePrices(saved.map((item) => ({ ...item, priceAdjustment: String(item.priceAdjustment) })));
      setPriceNotice('Đã lưu phụ thu. Giá mới áp dụng khi khách tạo đơn.');
      await loadProducts();
    } catch (error) { setPriceError(error instanceof Error ? error.message : 'Không thể lưu phụ thu.'); }
    finally { setPriceLoading(false); }
  }

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
      await deleteProduct(id);
      setProducts(products.filter((item) => item.id !== id));
      setPriceProduct((current) => current?.id === id ? null : current);
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
                      <Link href="/admin/recipes" className={smallButton} title="Cài đặt công thức theo size">
                        <BookOpen size={15} aria-hidden="true" /> Công thức
                      </Link>
                      <button type="button" onClick={() => void editPrices(item)} disabled={priceLoading} className={smallButton}>Phụ thu size</button>
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

      {priceProduct && <section aria-labelledby="size-prices-title" className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="size-prices-title" className="font-display text-xl font-bold text-navy">Phụ thu theo size · {priceProduct.name}</h2><p className="mt-1 text-sm text-content-secondary">Giá gốc {priceProduct.basePrice.toLocaleString('vi-VN')} ₫. Các size chưa có công thức vẫn có thể thiết lập giá.</p></div><button type="button" onClick={() => setPriceProduct(null)} disabled={priceLoading} className={smallButton}>Đóng</button></div>
        {priceError && <p role="alert" className="mt-4 text-sm text-danger">{priceError}</p>}
        {priceNotice && <p role="status" className="mt-4 text-sm text-success">{priceNotice}</p>}
        {priceLoading && !sizePrices.length ? <p role="status" className="mt-4 text-sm">Đang tải phụ thu...</p> : <form onSubmit={savePrices} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">{sizePrices.map((item, index) => <label key={item.size} className="block text-sm font-semibold text-navy">Size {item.size} · Phụ thu (₫)<input required type="number" min="0" max="1000000000" step="1" value={item.priceAdjustment} disabled={priceLoading} onChange={(event) => { const value = event.target.value; setSizePrices((current) => current.map((price, i) => i === index ? { ...price, priceAdjustment: value } : price)); }} className="field mt-2" /><span className="mt-1 block text-xs font-normal text-content-secondary">Giá bán: {(priceProduct.basePrice + (Number(item.priceAdjustment) || 0)).toLocaleString('vi-VN')} ₫</span></label>)}</div>
          <button type="submit" disabled={priceLoading || !sizePrices.length || sizePrices.some((item) => item.priceAdjustment === '' || !Number.isSafeInteger(Number(item.priceAdjustment)) || Number(item.priceAdjustment) < 0 || Number(item.priceAdjustment) > 1000000000)} className="btn-primary disabled:opacity-50">{priceLoading ? 'Đang lưu...' : 'Lưu phụ thu'}</button>
        </form>}
      </section>}

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
              <p className="text-sm text-content-secondary">Sau khi tạo, hãy thiết lập công thức cho từng size. Số ly có thể bán được tính từ tồn nguyên liệu.</p>
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
