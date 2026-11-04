"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  Coffee,
  PackageX,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { getAdminOrders } from "@/services/admin-order.service";

type Metrics = {
  orders: number | null;
  paid: number | null;
  products: number | null;
  lowStock: { id: string; name: string; stock: number; unit: string }[];
  updatedAt: string;
};

const initialMetrics: Metrics = { orders: null, paid: null, products: null, lowStock: [], updatedAt: "" };

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);

  useEffect(() => {
    let active = true;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

    async function load() {
      const [productResult, stockResult] = await Promise.allSettled([
        fetch(`${API_URL}/products/stats/count`).then((response) => response.json()),
        fetch(`${API_URL}/ingredients/stats/low-stock`).then((response) => response.json()),
      ]);

      let products: number | null = null;
      if (productResult.status === "fulfilled") {
        const payload = productResult.value?.data;
        if (typeof payload === "number") products = payload;
        else if (typeof payload?.data === "number") products = payload.data;
      }

      let lowStock: Metrics["lowStock"] = [];
      if (stockResult.status === "fulfilled") {
        const payload = stockResult.value?.data;
        if (Array.isArray(payload)) lowStock = payload;
        else if (Array.isArray(payload?.data)) lowStock = payload.data;
      }

      let orders: number | null = null;
      let paid: number | null = null;
      if (localStorage.getItem("token")) {
        const [allResult, paidResult] = await Promise.allSettled([
          getAdminOrders(1, ""),
          getAdminOrders(1, "PAID"),
        ]);
        if (allResult.status === "fulfilled") orders = allResult.value.pagination.total;
        if (paidResult.status === "fulfilled") paid = paidResult.value.pagination.total;
      }

      if (active) setMetrics({
        orders, paid, products, lowStock,
        updatedAt: new Intl.DateTimeFormat("vi-VN", { timeStyle: "short" }).format(new Date()),
      });
    }

    void load();
    return () => { active = false; };
  }, []);

  const cards = [
    {
      href: "/admin/orders",
      code: "01",
      label: "Đơn hàng",
      value: metrics.orders === null ? "—" : metrics.orders.toLocaleString("vi-VN"),
      caption: metrics.orders === null ? "Đăng nhập quản trị để xem" : "Tổng đơn trong hệ thống",
      icon: ShoppingBag,
    },
    {
      href: "/admin/orders",
      code: "02",
      label: "Đã thanh toán",
      value: metrics.paid === null ? "—" : metrics.paid.toLocaleString("vi-VN"),
      caption: metrics.paid === null ? "Cần quyền quản trị" : "Đơn đã ghi nhận thanh toán",
      icon: Wallet,
    },
    {
      href: "/admin/products",
      code: "03",
      label: "Món trên menu",
      value: metrics.products === null ? "—" : metrics.products.toLocaleString("vi-VN"),
      caption: "Sản phẩm đang có trong thực đơn",
      icon: Coffee,
    },
    {
      href: "/admin/ingredients",
      code: "04",
      label: "Nguyên liệu sắp hết",
      value: metrics.lowStock.length.toLocaleString("vi-VN"),
      caption: "Mặt hàng cần bổ sung sớm",
      icon: CircleAlert,
      danger: true,
    },
  ];

  return <section className="mx-auto max-w-6xl space-y-8">
    <header className="border-b-[1.5px] border-ink pb-5">
      <p className="kicker">Sổ quản trị · Tổng quan</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Quán đang chạy thế nào?</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Theo dõi đơn hàng, thực đơn và tồn kho trong một lượt xem.</p>
        </div>
        <span className="rounded-ticket border border-ink/25 bg-white px-3 py-2 text-xs font-semibold text-content-secondary">
          {metrics.updatedAt ? `Cập nhật ${metrics.updatedAt}` : "Đang tải số liệu…"}
        </span>
      </div>
    </header>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ href, code, label, value, caption, icon: Icon, danger }) => <Link
        key={code}
        href={href}
        className={`ticket group flex flex-col justify-between p-5 transition-transform hover:-translate-y-0.5 hover:shadow-ticket-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${danger && metrics.lowStock.length > 0 ? "border-danger" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-content-secondary">{code}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{label}</p>
          </div>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-ticket border ${danger && metrics.lowStock.length > 0 ? "border-danger/30 bg-danger-light text-danger" : "border-ink/20 bg-paper text-primary"}`}>
            <Icon size={18} aria-hidden="true" />
          </span>
        </div>
        <div className="mt-5">
          <p className={`price text-3xl font-bold tracking-[-0.02em] ${danger && metrics.lowStock.length > 0 ? "text-danger" : "text-ink"}`}>{value}</p>
          <p className="mt-2 text-xs leading-5 text-content-secondary">{caption}</p>
        </div>
      </Link>)}
    </div>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section aria-labelledby="stock-title" className="ticket p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 pb-4">
          <h2 id="stock-title" className="flex items-center gap-2 text-lg font-bold"><PackageX size={19} className="text-danger" aria-hidden="true" /> Cảnh báo tồn kho</h2>
          <Link href="/admin/ingredients" className="text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Quản lý kho</Link>
        </div>
        <div className="divide-y divide-ink/10">
          {metrics.lowStock.length === 0 ? <p className="py-6 text-sm text-content-secondary">Kho nguyên liệu đang ở mức an toàn.</p> : metrics.lowStock.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3.5">
            <span className="font-medium text-ink">{item.name}</span>
            <span className="price whitespace-nowrap rounded-ticket bg-danger-light px-2.5 py-1 text-xs font-bold text-danger">Còn {item.stock.toLocaleString("vi-VN")} {item.unit}</span>
          </div>)}
        </div>
      </section>

      <section aria-labelledby="shortcuts-title" className="ticket p-5 sm:p-6">
        <div className="border-b border-ink/15 pb-4">
          <h2 id="shortcuts-title" className="flex items-center gap-2 text-lg font-bold"><ReceiptText size={19} className="text-primary" aria-hidden="true" /> Lối tắt vận hành</h2>
          <p className="mt-1 text-xs leading-5 text-content-secondary">Những việc thường làm trong ca.</p>
        </div>
        <div className="divide-y divide-ink/10">
          {[
            { href: "/admin/orders", label: "Xử lý đơn hàng", hint: "Chuẩn bị, sẵn sàng, hoàn thành hoặc hủy đơn." },
            { href: "/admin/products", label: "Cập nhật thực đơn", hint: "Thêm món mới và chỉnh công thức định lượng." },
            { href: "/admin/imports", label: "Nhập hàng vào kho", hint: "Ghi phiếu nhập để cộng tồn và cập nhật giá vốn." },
            { href: "/admin/payments", label: "Đối soát thanh toán", hint: "Kiểm tra giao dịch Mock và ZaloPay Sandbox." },
          ].map((item) => <Link key={item.href} href={item.href} className="group flex items-center justify-between gap-3 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span>
              <span className="block text-sm font-semibold text-ink group-hover:text-primary">{item.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-content-secondary">{item.hint}</span>
            </span>
            <ArrowUpRight size={17} className="shrink-0 text-content-secondary transition-colors group-hover:text-primary" aria-hidden="true" />
          </Link>)}
        </div>
      </section>
    </div>
  </section>;
}
