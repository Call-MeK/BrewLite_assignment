"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Coffee,
  AlertTriangle,
  PackageX,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      try {
        // 1. Gọi API đếm sản phẩm
        const prodRes = await fetch(`${API_URL}/products/stats/count`);
        const prodData = await prodRes.json();

        // FIX LỖI: Bóc tách an toàn và ép kiểu 100% về số (Number)
        let count = 0;
        if (typeof prodData.data === "number") count = prodData.data;
        else if (prodData.data && typeof prodData.data.data === "number")
          count = prodData.data.data;
        setTotalProducts(count);

        // 2. Gọi API nguyên liệu sắp hết
        const ingRes = await fetch(`${API_URL}/ingredients/stats/low-stock`);
        const ingData = await ingRes.json();

        // FIX LỖI: Đảm bảo dữ liệu nhận được phải là một Mảng (Array)
        let items = [];
        if (Array.isArray(ingData.data)) items = ingData.data;
        else if (ingData.data && Array.isArray(ingData.data.data))
          items = ingData.data.data;
        setLowStockItems(items);
      } catch (error) {
        console.error("Lỗi tải dữ liệu dashboard:", error);
      }
    };
    fetchDashboardData();
  }, []);
  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800">
          Chào buổi chiều, Admin! ☀️
        </h1>
        <p className="text-slate-500 mt-1">
          Dưới đây là tình hình hoạt động của quán cà phê hôm nay.
        </p>
      </div>

      {/* THẺ THỐNG KÊ (KPI CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ tĩnh: Chờ Phúc làm Payment */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              +12.5%
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">12,340,000 ₫</h3>
            <p className="text-sm text-slate-500 font-medium">
              Tổng doanh thu (Tạm tính)
            </p>
          </div>
        </div>

        {/* Thẻ tĩnh: Chờ Order/Payment */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ShoppingBag size={20} />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              +8.2%
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">158</h3>
            <p className="text-sm text-slate-500 font-medium">
              Đơn hàng hoàn tất
            </p>
          </div>
        </div>

        {/* Thẻ của bạn: Thuộc Product Management */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Coffee size={20} />
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
              Đang bán
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">
              {totalProducts}
            </h3>
            <p className="text-sm text-slate-500 font-medium">
              Tổng món trên Menu
            </p>
          </div>
        </div>

        {/* Thẻ của bạn: Thuộc Ingredient Management */}
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-between bg-red-50/30">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
              Cần chú ý
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-red-600">
              {lowStockItems.length}
            </h3>
            <p className="text-sm text-red-500 font-medium">
              Nguyên liệu sắp hết
            </p>
          </div>
        </div>
      </div>

      {/* KHU VỰC CHI TIẾT DƯỚI BẢNG (Dành riêng cho Kho) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <PackageX className="text-red-500" size={24} />
            <h2 className="text-lg font-bold text-slate-800">
              Cảnh báo tồn kho
            </h2>
          </div>

          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-500">
                Kho nguyên liệu đang ở mức an toàn.
              </p>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100"
                >
                  <span className="font-medium text-slate-700">
                    {item.name}
                  </span>
                  <span className="font-bold text-red-500">
                    Còn {item.stock} {item.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
