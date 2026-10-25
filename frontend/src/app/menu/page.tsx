'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Coffee, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { filterMenu } from '@/lib/menu-filter';
import { getProducts } from '@/services/product.service';
import type { ProductSummary } from '@/types/product';
import { ProductPurchaseModal } from '@/components/menu/product-purchase-modal';

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export default function MenuPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [cartNotice, setCartNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);

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

  const categories = [...new Set(products.map((product) => product.categoryName).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'vi'));
  const filtered = filterMenu(products, keyword, category);

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-navy p-7 text-white sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-white/5" aria-hidden="true" />
        <div className="relative">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f2c697]">Thực đơn BrewLite</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tìm món hợp gu của bạn</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#f0e3d8] sm:text-base">Chọn ly yêu thích, tùy chỉnh size và topping rồi đặt ngay.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-primary">Khám phá đồ uống</p>
          <h2 className="mt-1 text-2xl font-black text-navy">Tất cả sản phẩm</h2>
        </div>
        <label className="block w-full sm:max-w-sm">
          <span className="sr-only">Tìm sản phẩm</span>
          <span className="flex min-h-12 items-center gap-3 rounded-xl border border-border-light bg-white px-4 text-content-secondary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search size={19} aria-hidden="true" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm tên đồ uống..." className="w-full bg-transparent py-3 text-content-primary outline-none" />
          </span>
        </label>
      </div>

      {categories.length > 0 && <div aria-label="Lọc theo danh mục" className="flex flex-wrap gap-2">
        {['', ...categories].map((name) => <button key={name} type="button" onClick={() => setCategory(name)} aria-pressed={category === name} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${category === name ? 'border-primary bg-primary text-white' : 'border-border-light bg-white text-navy hover:border-primary'}`}>
          {name || 'Tất cả'}
        </button>)}
      </div>}

      {cartNotice && <div role={cartNotice.ok ? 'status' : 'alert'} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 text-sm font-medium ${cartNotice.ok ? 'bg-success-light text-success' : 'bg-red-50 text-red-800'}`}>
        <span>{cartNotice.text}</span>
        {cartNotice.ok && <Link href="/cart" className="underline">Xác nhận món</Link>}
      </div>}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="animate-pulse overflow-hidden rounded-2xl border border-border-light bg-white"><div className="h-44 bg-slate-100" /><div className="space-y-3 p-5"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-4 w-1/3 rounded bg-slate-100" /></div></div>)}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-800">{error}</p>
          <button onClick={() => void loadProducts()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><RefreshCw size={16} aria-hidden="true" /> Thử lại</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border-light bg-white p-10 text-center text-content-secondary">
          <Coffee className="mx-auto mb-3" size={30} />
          {products.length ? 'Không tìm thấy món phù hợp.' : 'Hiện chưa có sản phẩm nào trong thực đơn.'}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <article key={product.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-shadow hover:shadow-lg">
              <Link href={`/products/${product.id}`} className="block flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <div className="relative flex h-48 items-center justify-center overflow-hidden bg-primary-light">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <Coffee size={54} className="text-primary/50" aria-hidden="true" />}
                  {!product.isAvailable && <span className="absolute right-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">Hết hàng</span>}
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{product.categoryName || 'Đồ uống BrewLite'}</p>
                  <h2 className="mt-2 text-lg font-bold text-navy">{product.name}</h2>
                  <p className="mt-2 text-base font-extrabold text-primary">Từ {money(product.basePrice)}</p>
                  <p className="mt-2 text-sm text-content-secondary">{product.categoryName === 'Cà phê' ? 'Chọn size theo sở thích' : 'Tùy chọn size và topping theo sở thích'}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Xem chi tiết và tùy chỉnh <ShoppingBag size={16} aria-hidden="true" /></span>
                </div>
              </Link>
              <div className="px-5 pb-5">
                <button type="button" onClick={() => { setCartNotice(null); setSelectedProduct(product); }} disabled={!product.isAvailable || !product.sizePrices?.length} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                  <ShoppingBag size={18} aria-hidden="true" /> {product.sizePrices?.length ? 'Đặt mua' : 'Chưa có size'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {selectedProduct && <ProductPurchaseModal key={selectedProduct.id} productId={selectedProduct.id} onClose={() => setSelectedProduct(null)} onSaved={() => { setCartNotice({ text: `Đã thêm ${selectedProduct.name} vào món đã chọn.`, ok: true }); setSelectedProduct(null); }} />}
    </section>
  );
}
