'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRequestCooldown } from '@/components/use-request-cooldown';
import { Coffee, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { filterMenu } from '@/lib/menu-filter';
import { resolveProductImage } from '@/lib/local-product-images';
import { getProducts } from '@/services/product.service';
import type { ProductSummary } from '@/types/product';
import { ProductPurchaseModal } from '@/components/menu/product-purchase-modal';

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export default function MenuPage() {
  const cooldown = useRequestCooldown('GET', '/products');
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
      <header className="border-b-[1.5px] border-ink pb-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="kicker">Thực đơn</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">
              Tìm món hợp gu của bạn
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-content-secondary">
              {loading ? 'Đang tải thực đơn…' : `${products.length} món đang phục vụ. Chọn size và topping ở bước tiếp theo.`}
            </p>
          </div>

          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">Tìm sản phẩm</span>
            <span className="flex min-h-12 items-center gap-3 rounded-ticket border border-ink/25 bg-white px-4 text-content-secondary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <Search size={18} aria-hidden="true" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm tên đồ uống"
                className="w-full bg-transparent py-3 text-content-primary outline-none placeholder:text-content-secondary/60"
              />
            </span>
          </label>
        </div>
      </header>

      {categories.length > 0 && (
        <div aria-label="Lọc theo danh mục" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-ink/15">
          {['', ...categories].map((name) => (
            <button
              key={name || 'all'}
              type="button"
              onClick={() => setCategory(name)}
              aria-pressed={category === name}
              className={`tab ${category === name ? 'tab-active' : ''}`}
            >
              {name || 'Tất cả'}
            </button>
          ))}
        </div>
      )}

      {cartNotice && (
        <div
          role={cartNotice.ok ? 'status' : 'alert'}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-ticket border-l-4 p-4 text-sm font-medium ${
            cartNotice.ok
              ? 'border-success bg-success-light text-success'
              : 'border-danger bg-danger-light text-danger'
          }`}
        >
          <span>{cartNotice.text}</span>
          {cartNotice.ok && (
            <Link href="/cart" className="font-semibold underline underline-offset-4">
              Xác nhận món
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="animate-pulse overflow-hidden rounded-ticket border border-ink/15 bg-white">
              <div className="aspect-[4/3] bg-paper-deep" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-1/3 rounded bg-paper-deep" />
                <div className="h-4 w-2/3 rounded bg-paper-deep" />
                <div className="h-4 w-1/3 rounded bg-paper-deep" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="ticket p-8 text-center">
          <p className="font-semibold text-danger">{error}</p>
          <button
            disabled={cooldown.blocked}
            onClick={() => { if (cooldown.start()) void loadProducts(); }}
            className="btn-primary mt-4"
          >
            <RefreshCw size={16} aria-hidden="true" /> {cooldown.label || 'Thử lại'}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ticket p-10 text-center text-content-secondary">
          <Coffee className="mx-auto mb-3 text-primary" size={32} aria-hidden="true" />
          {products.length ? 'Không tìm thấy món phù hợp.' : 'Hiện chưa có sản phẩm nào trong thực đơn.'}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <article
              key={product.id}
              className="ticket group flex flex-col overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-ticket-hover"
            >
              <Link
                href={`/products/${product.id}`}
                className="block flex-1 rounded-ticket focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="relative aspect-[4/3] overflow-hidden border-b-[1.5px] border-ink/15 bg-paper-deep">
                  <img
                    src={resolveProductImage(product)}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  {!product.isAvailable && (
                    <span className="absolute right-3 top-3 rounded-ticket bg-ink px-2.5 py-1 text-xs font-bold text-paper">
                      Hết hàng
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold text-content-secondary">
                    {product.categoryName || 'Đồ uống BrewLite'}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-ink">{product.name}</h2>
                  <p className="price mt-2 text-base font-extrabold text-primary">
                    Từ {money(product.basePrice)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-content-secondary">
                    {product.categoryName === 'Cà phê' ? 'Chọn size theo sở thích' : 'Tùy chọn size và topping'}
                  </p>
                </div>
              </Link>

              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={() => { setCartNotice(null); setSelectedProduct(product); }}
                  disabled={!product.isAvailable || !product.sizePrices?.length}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShoppingBag size={17} aria-hidden="true" />
                  {product.sizePrices?.length ? 'Đặt mua' : 'Chưa có size'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductPurchaseModal
          key={selectedProduct.id}
          productId={selectedProduct.id}
          onClose={() => setSelectedProduct(null)}
          onSaved={() => {
            setCartNotice({ text: `Đã thêm ${selectedProduct.name} vào món đã chọn.`, ok: true });
            setSelectedProduct(null);
          }}
        />
      )}
    </section>
  );
}
