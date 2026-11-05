'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Coffee, Minus, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { addOrMergeCartItem } from '@/lib/cart-items';
import { getProductById } from '@/services/product.service';
import { resolveProductImage } from '@/lib/local-product-images';
import type { CartItemDraft, ProductDetail, ProductSize } from '@/types/product';
import { useRequestCooldown } from '@/components/use-request-cooldown';

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

function isValidProduct(value: ProductDetail): boolean {
  return Boolean(
    value && typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.basePrice === 'number' && Number.isFinite(value.basePrice) &&
    typeof value.currency === 'string' &&
    typeof value.isAvailable === 'boolean' &&
    Array.isArray(value.sizePrices) &&
    value.sizePrices.every((s) => typeof s.size === 'string' && Number.isFinite(s.priceAdjustment)) &&
    Array.isArray(value.toppings) &&
    value.toppings.every((t) => typeof t.id === 'string' && typeof t.name === 'string' && Number.isFinite(t.price)),
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const cooldown = useRequestCooldown('GET', `/products/${id}`);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSize, setSelectedSize] = useState<ProductSize | ''>('');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await getProductById(id);
      if (!isValidProduct(data)) {
        throw new Error('Dữ liệu sản phẩm không đúng định dạng. Vui lòng thử lại sau.');
      }
      setProduct(data);
      setSelectedSize(data.sizePrices.some((s) => s.size === 'M' && s.isAvailable) ? 'M' : (data.sizePrices.find((s) => s.isAvailable)?.size ?? ''));
      setSelectedToppings([]);
    } catch (e) {
      setProduct(null);
      if (e instanceof ApiError && e.statusCode === 404) setError('Không tìm thấy sản phẩm này.');
      else setError(e instanceof Error ? e.message : 'Không thể tải chi tiết sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadProduct(); }, [loadProduct]);

  const sizePrice = product?.sizePrices.find((s) => s.size === selectedSize);
  const selectedToppingItems = product?.toppings.filter((t) => selectedToppings.includes(t.id)) ?? [];
  const estimatedPrice = useMemo(() => {
    if (!product || !sizePrice) return null;
    return product.basePrice + sizePrice.priceAdjustment + selectedToppingItems.reduce((sum, item) => sum + item.price, 0);
  }, [product, sizePrice, selectedToppingItems]);

  function toggleTopping(toppingId: string) {
    setNotice('');
    setSelectedToppings((current) => {
      if (current.includes(toppingId)) return current.filter((idValue) => idValue !== toppingId);
      if (current.length >= 3) {
        setNotice('Bạn chỉ có thể chọn tối đa 3 loại topping cho mỗi ly.');
        return current;
      }
      return [...current, toppingId];
    });
  }

  function addToCart() {
    if (!product || !product.isAvailable || !sizePrice?.isAvailable || quantity > sizePrice.availableQuantity || !selectedSize || estimatedPrice === null) return;
    setAdding(true);
    setNotice('');
    try {
      const newItem: CartItemDraft = {
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        size: selectedSize,
        toppingIds: selectedToppingItems.map((item) => item.id),
        toppingNames: selectedToppingItems.map((item) => item.name),
        quantity,
        estimatedUnitPrice: estimatedPrice,
        currency: product.currency,
      };
      const saved = localStorage.getItem('brewlite-cart');
      const items: CartItemDraft[] = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(items)) throw new Error('Danh sách món đã chọn không hợp lệ.');
      localStorage.setItem('brewlite-cart', JSON.stringify(addOrMergeCartItem(items, newItem)));
      window.dispatchEvent(new Event('cart-changed'));
      setNotice(`Đã thêm ${product.name}. Mở biểu tượng túi món ở đầu trang để xem.`);
      setAdding(false);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Không thể thêm món. Vui lòng thử lại.');
      setAdding(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl animate-pulse space-y-5"><div className="h-5 w-36 rounded bg-slate-200" /><div className="grid gap-8 md:grid-cols-2"><div className="h-80 rounded-3xl bg-slate-200" /><div className="space-y-4"><div className="h-8 w-3/4 rounded bg-slate-200" /><div className="h-5 w-1/3 rounded bg-slate-200" /><div className="h-36 rounded-2xl bg-slate-100" /></div></div></div>;
  }

  if (error || !product) {
    return <div className="ticket mx-auto max-w-xl p-8 text-center">
      <Coffee className="mx-auto mb-4 text-primary" size={38} />
      <h1 className="text-2xl font-extrabold text-navy">{error.includes('Không tìm thấy') ? 'Không tìm thấy sản phẩm' : 'Chưa thể tải sản phẩm'}</h1>
      <p className="mt-3 text-content-secondary">{error || 'Dữ liệu sản phẩm không khả dụng.'}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button disabled={cooldown.blocked} onClick={() => { if (cooldown.start()) void loadProduct(); }} className="btn-primary"><RefreshCw size={17} /> {cooldown.label || 'Thử lại'}</button>
        <Link href="/menu" className="btn-outline">Quay lại thực đơn</Link>
      </div>
    </div>;
  }

  return <div className="mx-auto max-w-5xl space-y-5">
    <Link href="/menu" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-content-secondary transition hover:text-primary"><ArrowLeft size={17} /> Quay lại thực đơn</Link>
    <div className="ticket grid overflow-hidden md:grid-cols-2">
      <div className="relative flex min-h-[300px] items-center justify-center border-b-[1.5px] border-ink/15 bg-paper-deep md:min-h-[560px] md:border-b-0 md:border-r-[1.5px]">
        {product.imageUrl ? <img src={resolveProductImage(product)} alt={product.name} className="h-full max-h-[560px] w-full object-cover" /> : <div className="p-12 text-center"><Coffee size={88} className="mx-auto text-[#a77b50]" /><p className="mt-4 font-medium text-[#80674f]">Ảnh đồ uống BrewLite</p></div>}
        {!product.isAvailable && <span className="absolute left-5 top-5 rounded-ticket bg-danger px-4 py-2 text-sm font-bold text-white">Hiện hết hàng</span>}
      </div>

      <div className="flex flex-col p-6 sm:p-8 lg:p-10">
        <p className="kicker">BrewLite, chi tiết sản phẩm</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-navy">{product.name}</h1>
        <p className="mt-3 text-sm leading-6 text-content-secondary">{product.categorySlug === 'ca-phe' ? 'Chọn size cà phê theo sở thích của bạn.' : 'Tùy chỉnh size và topping để tạo nên ly đồ uống theo sở thích của bạn.'}</p>
        <div className="mt-5 border-b border-dashed border-ink/25 pb-5">
          <p className="text-sm text-content-secondary">Giá gốc</p>
          <p className="price mt-1 text-2xl font-extrabold text-primary">{money(product.basePrice)}</p>
        </div>

        <fieldset disabled={!product.isAvailable} className="mt-6">
          <legend className="mb-3 font-bold text-navy">1. Chọn kích cỡ <span className="text-danger">*</span></legend>
          {product.sizePrices.length === 0 ? <p className="rounded-ticket border-l-4 border-accent bg-accent-soft p-3 text-sm text-ink">Sản phẩm chưa có kích cỡ khả dụng.</p> :
            <div className="grid grid-cols-3 gap-3">
              {product.sizePrices.map((item) => {
                const active = selectedSize === item.size;
                return <button type="button" key={item.size} disabled={!item.isAvailable} onClick={() => { setSelectedSize(item.size); setNotice(''); }} className={`rounded-ticket border-[1.5px] p-3 text-left transition ${active ? 'border-primary bg-primary-light' : 'border-ink/20 hover:border-primary/60'}`}>
                  <span className="price flex items-center justify-between font-extrabold text-navy">{item.size}{active && <Check size={15} className="text-primary" />}</span>
                  <span className="mt-1 block text-xs text-content-secondary">{!item.isAvailable ? 'Hết nguyên liệu' : item.priceAdjustment > 0 ? '+' + money(item.priceAdjustment) : 'Không phụ thu'}</span>
                </button>;
              })}
            </div>}
        </fieldset>

        {product.categorySlug !== 'ca-phe' && <fieldset disabled={!product.isAvailable} className="mt-7">
          <legend className="mb-1 font-bold text-navy">2. Thêm topping <span className="text-xs font-normal text-content-secondary">(tối đa 3)</span></legend>
          <p className="mb-3 text-xs text-content-secondary">Chọn thêm để ly nước hợp khẩu vị hơn.</p>
          {product.toppings.length === 0 ? <p className="rounded-ticket border border-ink/15 bg-paper p-3 text-sm text-content-secondary">Hiện chưa có topping khả dụng.</p> :
            <div className="space-y-2">
              {product.toppings.map((item) => {
                const active = selectedToppings.includes(item.id);
                return <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-ticket border p-3 transition ${active ? 'border-primary bg-primary-light' : 'border-ink/20 hover:border-primary/60'}`}>
                  <input type="checkbox" checked={active} onChange={() => toggleTopping(item.id)} disabled={!active && selectedToppings.length >= 3} className="h-4 w-4 accent-primary" />
                  <span className="flex-1 text-sm font-semibold text-navy">{item.name}</span>
                  <span className="price text-sm font-semibold text-content-secondary">+{money(item.price)}</span>
                </label>;
              })}
            </div>}
        </fieldset>}

        <div className="mt-7 flex items-center justify-between rounded-ticket border border-dashed border-ink/30 bg-paper p-4">
          <div><p className="text-sm font-semibold text-ink">Số lượng</p><p className="mt-1 text-xs text-content-secondary">Từ 1 đến 99 ly</p></div>
          <div className="flex items-center gap-4">
            <button aria-label="Giảm số lượng" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="flex h-11 w-11 items-center justify-center rounded-ticket border border-ink/20 bg-white text-ink disabled:opacity-40"><Minus size={16} /></button>
            <span className="price min-w-5 text-center font-bold text-navy">{quantity}</span>
            <button aria-label="Tăng số lượng" onClick={() => setQuantity((q) => Math.min(99, q + 1))} disabled={quantity >= 99} className="flex h-11 w-11 items-center justify-center rounded-ticket border border-ink/20 bg-white text-ink disabled:opacity-40"><Plus size={16} /></button>
          </div>
        </div>

        {notice && <p role="status" className="mt-4 rounded-ticket border-l-4 border-primary bg-primary-light p-3 text-sm text-primary">{notice}</p>}
        <div className="mt-6 border-t border-dashed border-ink/25 pt-5">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-sm text-content-secondary">Giá ước tính / ly</p><p className="price mt-1 text-2xl font-extrabold text-navy">{estimatedPrice === null ? '—' : money(estimatedPrice)}</p></div>
            <div className="text-right"><p className="text-sm text-content-secondary">Tạm tính</p><p className="price mt-1 text-lg font-bold text-primary">{estimatedPrice === null ? '—' : money(estimatedPrice * quantity)}</p></div>
          </div>
          {sizePrice && <p className="mt-3 text-sm text-content-secondary">Size {sizePrice.size} có thể làm tối đa {sizePrice.availableQuantity} ly từ nguyên liệu hiện có.</p>}
          <button onClick={addToCart} disabled={!product.isAvailable || !sizePrice?.isAvailable || quantity > sizePrice.availableQuantity || !selectedSize || estimatedPrice === null || adding} className="btn-primary mt-5 w-full px-5 py-4 disabled:cursor-not-allowed disabled:opacity-40">
            <ShoppingBag size={19} />{!product.isAvailable ? 'Sản phẩm hiện hết hàng' : adding ? 'Đang thêm...' : 'Thêm món đã chọn'}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-content-secondary">Giá trên trang là giá ước tính. Giá cuối cùng sẽ được hệ thống xác nhận khi đặt hàng.</p>
        </div>
      </div>
    </div>
  </div>;
}
