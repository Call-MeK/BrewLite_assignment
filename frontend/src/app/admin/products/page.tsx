"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, BookOpen, X } from "lucide-react";
import {
  getAllProducts,
  createProduct,
  getAllCategories,
  getProductRecipe,
  addRecipeItem,
  removeRecipeItem,
} from "@/services/product.service";
import { ingredientsService } from "@/services/ingredients.service";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]); // Danh sách nguyên liệu thật

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    basePrice: 0,
  });

  // States cho Modal Công thức (Recipe)
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [recipeItems, setRecipeItems] = useState<any[]>([]); // Chứa công thức thật

  // State cho form nhập định lượng
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

  // --- XỬ LÝ CÔNG THỨC ---
  const openRecipeModal = async (product: any) => {
    setSelectedProduct(product);
    setIsRecipeModalOpen(true);
    setRecipeItems([]); // Clear cũ
    try {
      const data = await getProductRecipe(product.id);

      // SỬA ĐOẠN NÀY: Kiểm tra an toàn trước khi gán
      if (Array.isArray(data)) {
        setRecipeItems(data);
      } else if (data && Array.isArray(data.data)) {
        // Bóc thêm một lớp data nếu Backend bọc lồng
        setRecipeItems(data.data);
      } else {
        setRecipeItems([]); // Nếu lỗi, gán mảng rỗng để không bị sập trang
        console.log("Dữ liệu trả về không đúng định dạng mảng:", data);
      }
    } catch (error) {
      console.error("Lỗi tải công thức", error);
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedIngredientId || !quantity)
      return alert("Vui lòng chọn nguyên liệu và nhập số lượng");
    try {
      await addRecipeItem(
        selectedProduct.id,
        selectedIngredientId,
        Number(quantity),
      );

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
    if (
      !confirm(
        "Bạn có chắc chắn muốn xóa sản phẩm này? Toàn bộ công thức đi kèm cũng sẽ bị xóa.",
      )
    )
      return;

    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Lọc bỏ sản phẩm vừa xóa khỏi danh sách hiện tại trên giao diện
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
      setRecipeItems(
        recipeItems.filter((item) => item.ingredientId !== ingredientId),
      );
    } catch (error) {
      alert("Lỗi xóa nguyên liệu");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-800">Quản lý Sản phẩm</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#A07049] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#8b5e3c] transition shadow-md flex items-center gap-2"
        >
          <Plus size={18} /> Thêm món mới
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
            <tr>
              <th className="p-4">Tên sản phẩm</th>
              <th className="p-4">Danh mục</th>
              <th className="p-4">Giá gốc</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
            {products.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="p-4">{item.name}</td>
                <td className="p-4">
                  {item.category?.name || item.categoryName || "---"}
                </td>
                <td className="p-4">{item.basePrice?.toLocaleString()} ₫</td>
                <td className="p-4 flex justify-end gap-2">
                  <button
                    onClick={() => openRecipeModal(item)}
                    className="text-amber-600 hover:text-amber-800 bg-amber-50 p-2 rounded-lg transition mr-2 flex items-center gap-1"
                    title="Cài đặt công thức"
                  >
                    <BookOpen size={16} />{" "}
                    <span className="text-xs font-bold">Công thức</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm Món Cũ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-[400px]">
            <h2 className="text-xl font-black text-slate-800 mb-4">
              Thêm sản phẩm mới
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tên món
                </label>
                <input
                  required
                  type="text"
                  className="w-full border p-2.5 rounded-xl bg-white"
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Danh mục
                </label>
                <select
                  required
                  className="w-full border p-2.5 rounded-xl bg-white"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  <option value="" disabled>
                    -- Chọn danh mục --
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Giá gốc (VNĐ)
                </label>
                <input
                  required
                  type="number"
                  className="w-full border p-2.5 rounded-xl bg-white"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      basePrice: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#A07049] text-white font-bold rounded-xl hover:bg-[#8b5e3c]"
                >
                  Lưu sản phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ CÔNG THỨC THẬT */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-[600px] flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-black text-slate-800">
                  Công thức định lượng
                </h2>
                <p className="text-sm font-medium text-amber-700 mt-1">
                  Sản phẩm: {selectedProduct?.name}
                </p>
              </div>
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-white p-2 rounded-full shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    Chọn Nguyên Liệu
                  </label>
                  <select
                    className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white"
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                  >
                    <option value="">-- Chọn --</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    Định lượng
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="VD: 20"
                  />
                </div>
                <button
                  onClick={handleAddRecipe}
                  className="bg-[#A07049] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#8b5e3c] h-[38px]"
                >
                  Thêm
                </button>
              </div>

              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
                Thành phần hiện tại
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-semibold text-slate-600">
                        Tên nguyên liệu
                      </th>
                      <th className="p-3 font-semibold text-slate-600">
                        Định lượng
                      </th>
                      <th className="p-3 text-right font-semibold text-slate-600">
                        Xóa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!Array.isArray(recipeItems) || recipeItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-4 text-center text-slate-400"
                        >
                          Chưa có nguyên liệu nào.
                        </td>
                      </tr>
                    ) : (
                      recipeItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-800">
                            {item.ingredient?.name}
                          </td>
                          <td className="p-3 font-bold text-amber-600">
                            {item.quantity} {item.ingredient?.unit}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() =>
                                handleDeleteRecipe(item.ingredientId)
                              }
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {recipeItems.length > 0 && (
                    <tfoot className="bg-amber-50/50 border-t-2 border-amber-200">
                      <tr>
                        <td
                          colSpan={2}
                          className="p-3 text-right font-black text-slate-700 uppercase text-xs"
                        >
                          Tổng giá vốn (COGS):
                        </td>
                        <td
                          colSpan={2}
                          className="p-3 font-black text-red-600 text-lg"
                        >
                          {recipeItems
                            .reduce((sum, item) => {
                              // Giả sử item.ingredient.price là giá trên 1 đơn vị (1 gram/1 ml)
                              const cost =
                                item.quantity *
                                (Number(item.ingredient?.price) || 0);
                              return sum + cost;
                            }, 0)
                            .toLocaleString()}{" "}
                          ₫
                        </td>
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
