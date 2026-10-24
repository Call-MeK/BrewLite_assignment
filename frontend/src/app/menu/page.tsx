'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Coffee, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { getProducts } from '@/services/product.service';
import type { ProductSummary } from '@/types/product';

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export default function MenuPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      setProducts(await getProducts());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProducts(); }, []);

  const filtered = products.filter((p) =>
    p.name.toLocaleLowerCase('vi').includes(keyword.trim().toLocaleLowerCase('vi')),
  );

  return (
    <section className="space-y-7">
      <div className="rounded-3xl bg-gradient-to-r from-[#102b46] to-[#245b70] p-7 sm:p-10 text-white shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c9e4e7]">BrewLite · Menu</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-black">Chọn món bạn yêu thích</h1>
        <p className="mt-3 max-w-xl text-sm sm:text-base text-white/80">Khám phá đồ uống, chọn size và topping theo khẩu vị của bạn.</p>
        <div className="mt-6 flex max-w-lg items-center gap-3 rounded-2xl bg-white px-4 py-3 text-slate-500">
          <Search size={19} />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm tên đồ uống..." className="w-full bg-transparent text-slate-800 outline-none" aria-label="Tìm sản phẩm" />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="animate-pulse overflow-hidden rounded-2xl border border-border-light bg-white"><div className="h-44 bg-slate-100" /><div className="space-y-3 p-5"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-4 w-1/3 rounded bg-slate-100" /></div></div>)}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-800">{error}</p>
          <button onClick={() => void loadProducts()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-white"><RefreshCw size={16} /> Thử lại</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border-light bg-white p-10 text-center text-content-secondary">
          <Coffee className="mx-auto mb-3" size={30} />
          {products.length ? 'Không tìm thấy món phù hợp.' : 'Hiện chưa có sản phẩm nào trong thực đơn.'}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <article key={product.id} className="group overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <Link href={`/products/${product.id}`} className="block">
                <div className="relative flex h-48 items-center justify-center overflow-hidden bg-[#f5f0e8]">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <Coffee size={54} className="text-[#a77b50]" />}
                  {!product.isAvailable && <span className="absolute right-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">Hết hàng</span>}
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{product.categoryName || 'BrewLite selection'}</p>
                  <h2 className="mt-2 text-lg font-bold text-navy">{product.name}</h2>
                  <p className="mt-2 text-base font-extrabold text-primary">{money(product.basePrice)}</p>
                  <p className="mt-2 text-sm text-content-secondary">Tùy chọn size và topping theo sở thích</p>
                  <span className="mt-5 inline-flex items-center gap-2 font-semibold text-navy">{product.isAvailable ? 'Xem chi tiết' : 'Xem sản phẩm'} <ShoppingBag size={16} /></span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
