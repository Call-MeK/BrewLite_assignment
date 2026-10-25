'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Coffee, Minus, Plus, RefreshCw, ShoppingBag, X } from 'lucide-react';
import { addOrMergeCartItem, replaceCartItem } from '@/lib/cart-items';
import { getProductById } from '@/services/product.service';
import type { CartItemDraft, ProductDetail, ProductSize } from '@/types/product';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

interface Props {
  productId: string;
  initialItem?: CartItemDraft;
  editingIndex?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductPurchaseModal({ productId, initialItem, editingIndex, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [size, setSize] = useState<ProductSize | ''>('');
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setError('');
    getProductById(productId).then((data) => {
      if (!active) return;
      if (!Array.isArray(data.sizePrices) || !Array.isArray(data.toppings)) throw new Error('Dữ liệu sản phẩm không hợp lệ.');
      setProduct(data);
      setSize(data.sizePrices.find((option) => option.size === initialItem?.size)?.size ?? data.sizePrices.find((option) => option.size === 'M')?.size ?? data.sizePrices[0]?.size ?? '');
      setToppingIds(data.categorySlug === 'ca-phe' ? [] : data.toppings.filter((option) => initialItem?.toppingIds.includes(option.id)).map((option) => option.id));
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải sản phẩm.');
    });
    return () => { active = false; };
  }, [productId, initialItem, retry]);

  const sizePrice = product?.sizePrices.find((option) => option.size === size);
  const selectedToppings = product?.toppings.filter((option) => toppingIds.includes(option.id)) ?? [];
  const unitPrice = product && sizePrice ? product.basePrice + sizePrice.priceAdjustment + selectedToppings.reduce((sum, option) => sum + option.price, 0) : 0;
  const total = unitPrice * quantity;

  function toggleTopping(id: string) {
    setToppingIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : current);
  }

  function save() {
    if (!product || !product.isAvailable || !sizePrice || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    setError('');
    try {
      const stored = JSON.parse(localStorage.getItem('brewlite-cart') || '[]');
      if (!Array.isArray(stored)) throw new Error('Danh sách món đã chọn không hợp lệ.');
      const item: CartItemDraft = {
        productId: product.id, productName: product.name, imageUrl: product.imageUrl,
        size: sizePrice.size, toppingIds: selectedToppings.map((option) => option.id),
        toppingNames: selectedToppings.map((option) => option.name), quantity,
        estimatedUnitPrice: unitPrice, currency: product.currency,
      };
      const next = editingIndex === undefined ? addOrMergeCartItem(stored, item) : replaceCartItem(stored, editingIndex, item);
      localStorage.setItem('brewlite-cart', JSON.stringify(next));
      window.dispatchEvent(new Event('cart-changed'));
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu món đã chọn.');
    }
  }

  return <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-label="Đặt mua sản phẩm" className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-content-primary shadow-2xl backdrop:bg-black/70">
    <button type="button" onClick={onClose} aria-label="Đóng cửa sổ đặt mua" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy shadow-md hover:bg-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X size={21} /></button>
    {!product && !error ? <div className="grid min-h-80 place-items-center text-content-secondary" role="status">Đang tải sản phẩm...</div> : !product ? <div className="grid min-h-80 place-content-center p-8 text-center"><p role="alert" className="text-red-700">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-white"><RefreshCw size={17} /> Thử lại</button></div> : <div className="grid lg:grid-cols-[44%_56%]">
      <div className="flex h-52 items-center justify-center overflow-hidden bg-primary-light sm:h-72 lg:h-auto lg:min-h-[580px]">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <Coffee size={80} className="text-primary/40" aria-hidden="true" />}</div>
      <div className="flex flex-col p-5 sm:p-8 lg:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">BrewLite · Đặt mua</p>
        <h2 id="purchase-modal-title" className="mt-2 pr-10 text-2xl font-black text-navy sm:text-3xl">{product.name}</h2>
        <p className="mt-2 text-xl font-bold text-primary">{money(unitPrice || product.basePrice)} <span className="text-sm font-normal text-content-secondary">/ ly</span></p>
        <fieldset disabled={!product.isAvailable || !product.sizePrices.length} className="mt-6"><legend className="font-bold text-navy">Chọn size</legend><div className="mt-3 grid grid-cols-3 gap-2">{product.sizePrices.map((option) => <button type="button" key={option.size} onClick={() => setSize(option.size)} aria-pressed={size === option.size} className={`min-h-14 rounded-xl border px-3 py-2 text-left transition-colors ${size === option.size ? 'border-primary bg-primary-light text-primary' : 'border-border-light text-navy hover:border-primary'}`}><span className="flex items-center justify-between font-bold">{option.size}{size === option.size && <Check size={16} aria-hidden="true" />}</span><span className="block text-xs">{option.priceAdjustment ? `+${money(option.priceAdjustment)}` : 'Giá gốc'}</span></button>)}</div></fieldset>
        {product.categorySlug !== 'ca-phe' && <fieldset disabled={!product.isAvailable} className="mt-6"><legend className="font-bold text-navy">Topping <span className="text-sm font-normal text-content-secondary">(tối đa 3)</span></legend>{product.toppings.length ? <div className="mt-3 space-y-2">{product.toppings.map((option) => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-light px-3 py-2 hover:border-primary"><input type="checkbox" checked={toppingIds.includes(option.id)} onChange={() => toggleTopping(option.id)} disabled={!toppingIds.includes(option.id) && toppingIds.length >= 3} className="h-4 w-4 accent-primary" /><span className="flex-1 text-sm font-semibold text-navy">{option.name}</span><span className="text-sm text-content-secondary">+{money(option.price)}</span></label>)}</div> : <p className="mt-2 text-sm text-content-secondary">Hiện chưa có topping khả dụng.</p>}</fieldset>}
        <div className="mt-6 flex items-center justify-between gap-4"><span className="font-bold text-navy">Số lượng</span><div className="flex items-center gap-2"><button type="button" aria-label="Giảm số lượng" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-light disabled:opacity-40"><Minus size={17} /></button><span className="min-w-8 text-center font-bold text-navy">{quantity}</span><button type="button" aria-label="Tăng số lượng" disabled={quantity >= 99} onClick={() => setQuantity((value) => Math.min(99, value + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-light disabled:opacity-40"><Plus size={17} /></button></div></div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-6 border-t border-border-light pt-5 lg:mt-auto"><div className="mb-4 flex items-center justify-between gap-3 font-bold text-navy"><span>Tổng tiền</span><span className="text-xl text-primary">{money(total)}</span></div><button type="button" onClick={save} disabled={!product.isAvailable || !sizePrice} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag size={19} aria-hidden="true" />{editingIndex === undefined ? 'Thêm vào giỏ hàng' : 'Lưu thay đổi'} · {money(total)}</button><p className="mt-3 text-center text-xs text-content-secondary">Giá cuối cùng được xác nhận khi đặt hàng.</p></div>
      </div>
    </div>}
  </dialog>;
}
