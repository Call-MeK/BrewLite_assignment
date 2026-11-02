"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Coffee,
  Package,
  CheckCircle2,
  Store,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: <LayoutDashboard size={20} /> },
    {
      name: "Đơn hàng",
      path: "/admin/orders",
      icon: <ShoppingBag size={20} />,
    },
    { name: "Thực đơn", path: "/admin/products", icon: <Coffee size={20} /> },
    {
      name: "Kho Nguyên liệu",
      path: "/admin/ingredients",
      icon: <Package size={20} />,
    },
  ];

  return (
    // fixed inset-0 z-50 giúp Admin phủ kín toàn màn hình, che đi Navbar của User
    <div className="fixed inset-0 z-50 flex h-screen bg-[#fcfaf8] text-slate-800 font-sans">
      {/* Sidebar - Tone trắng, viền nhẹ */}
      <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-[#A07049] text-white p-2.5 rounded-xl shadow-md">
            <Coffee size={24} />
          </div>
          <div>
            <h2 className="font-black text-lg text-slate-800 leading-tight">
              BrewMaster
            </h2>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Admin Dashboard
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-[#A07049] text-white shadow-md shadow-[#A07049]/20"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* System Status & Nút về cửa hàng */}
        <div className="p-4 mx-4 mb-4 flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition px-2"
          >
            <Store size={16} /> Quay lại cửa hàng
          </Link>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4 flex items-start gap-3">
            <CheckCircle2 className="text-green-600 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-green-800">System Status</p>
              <p className="text-xs text-green-600 mt-1">
                All systems operational
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header giả lập cho giống thiết kế */}
        <header className="h-20 border-b border-slate-200/50 bg-white/50 backdrop-blur-sm flex justify-between items-center px-8">
          <div className="bg-white border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-400 w-96 flex items-center shadow-sm">
            🔍 Search orders, menu items...
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold">
              A
            </div>
          </div>
        </header>

        {/* Nơi chứa nội dung các trang con */}
        <div className="flex-1 overflow-auto p-8">{children}</div>
      </main>
    </div>
  );
}
