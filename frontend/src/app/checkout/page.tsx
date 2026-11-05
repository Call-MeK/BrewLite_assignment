'use client';

import { useRequestCooldown } from '@/components/use-request-cooldown';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgePercent, ShoppingBag } from 'lucide-react';
import { ApiError, fetchApi } from '@/lib/api-client';
import { reconcilePendingOrder, submitCheckoutOrder } from '@/lib/pending-order';
import { cancelOrder, createOrder, getOrder } from '@/services/order.service';
import type { CartItemDraft } from '@/types/product';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
type Promotion = { code: string; description: string | null; discountPercent: number | null; discountAmount: string | null; maxDiscount: string | null; minOrderAmount: string; endDate: string | null };

export default function CheckoutPage() {
  const cooldown = useRequestCooldown('POST', '/orders');
  const router = useRouter();
  const [items, setItems] = useState<CartItemDraft[]>([]);
  const [ready, setReady] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pointsError, setPointsError] = useState('');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionCode, setPromotionCode] = useState('');
  const [promotionStatus, setPromotionStatus] = useState('Đang tải ưu đãi...');
  const [pendingOrder, setPendingOrder] = useState<{ id: string; finalAmount?: number } | null>(null);

  useEffect(() => {
    fetchApi<Promotion[]>('/orders/promotions').then((data) => {
      setPromotions(data);
      setPromotionStatus(data.length ? '' : 'Hiện chưa có mã khuyến mãi.');
    }).catch(() => setPromotionStatus('Không tải được danh sách ưu đãi. Bạn vẫn có thể nhập mã.'));
    try {
      const parsed = JSON.parse(localStorage.getItem('brewlite-cart') || '[]');
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch { setItems([]); }
    if (!localStorage.getItem('token')) {
      setPointsLoading(false);
      setReady(true);
      return;
    }
    let active = true;
    fetchApi<{ id: string; loyaltyPoints: number }>('/auth/me').then(async (user) => {
      if (!active) return;
      setUserId(user.id);
      setAvailablePoints(user.loyaltyPoints);
      const order = await reconcilePendingOrder(localStorage, user.id, getOrder, cancelOrder);
      if (active && order) setPendingOrder(order);
    }).catch(() => {
      if (active) setPointsError('Chưa tải được điểm. Bạn có thể đặt hàng không dùng điểm.');
    }).finally(() => {
      if (active) {
        setPointsLoading(false);
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  const total = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);
  const selectedPromotion = promotions.find((promotion) => promotion.code === promotionCode.trim().toUpperCase());
  const promotionDiscount = selectedPromotion && total >= Number(selectedPromotion.minOrderAmount)
    ? Math.min(total, selectedPromotion.discountPercent !== null
      ? Math.min(Math.floor(total * selectedPromotion.discountPercent / 100), selectedPromotion.maxDiscount === null ? total : Number(selectedPromotion.maxDiscount))
      : Number(selectedPromotion.discountAmount ?? 0)) : 0;
  const maxPoints = Math.max(0, Math.min(Math.floor((availablePoints ?? 0) / 10) * 10, Math.floor((total - promotionDiscount) / 1000) * 10));
  const validPoints = Number.isSafeInteger(pointsToUse) && pointsToUse >= 0 && pointsToUse % 10 === 0 && pointsToUse <= maxPoints;
  const pointsDiscount = validPoints ? pointsToUse * 100 : 0;

  async function placeOrder() {
    if (busy || cooldown.blocked || !ready || items.length === 0) return;
    if (items.length > 50) { setError('Mỗi đơn hàng được tối đa 50 dòng món.'); return; }
    if (!validPoints) {
      setError('Điểm sử dụng phải là bội số của 10 và không vượt quá điểm khả dụng hoặc giá trị đơn hàng.');
      return;
    }
    if (!localStorage.getItem('token')) {
      router.push('/login?next=%2Fcheckout');
      return;
    }
    if (!userId) {
      setError('Could not verify your account. Sign in again before placing the order.');
      return;
    }
    if (!cooldown.start()) return;
    setBusy(true);
    setError('');
    try {
      const currentUser = await fetchApi<{ id: string; loyaltyPoints: number }>('/auth/me');
      if (currentUser.id !== userId) {
        await reconcilePendingOrder(localStorage, currentUser.id, getOrder, cancelOrder);
        setUserId(currentUser.id);
        setAvailablePoints(currentUser.loyaltyPoints);
        setPointsToUse(0);
        setError('Your account changed. Review your points and place the order again.');
        return;
      }
      const submission = await submitCheckoutOrder(localStorage, userId, getOrder, cancelOrder, createOrder, pointsToUse, currentUser.loyaltyPoints, promotionCode.trim().toUpperCase());
      if (submission.type === 'resume') {
        router.push(`/orders/${submission.order.id}/payment`);
        return;
      }
      if (submission.type === 'empty') {
        setItems([]);
        setError('Your cart is empty. Add an item before placing an order.');
        return;
      }
      if (submission.type === 'invalid-points') {
        setItems(submission.items);
        setError('The cart changed. Review the points to use before placing the order.');
        return;
      }
      router.push(`/orders/${submission.order.id}/payment`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 401) router.push('/login?next=%2Fcheckout');
      else setError(cause instanceof Error ? cause.message : 'Không thể đặt hàng.');
    } finally { setBusy(false); }
  }

  if (!ready) return <p role="status" className="text-content-secondary">Đang tải món đã chọn...</p>;

  return <section className="mx-auto max-w-4xl space-y-6">
    <Link href="/cart" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={17} /> Quay lại xác nhận món</Link>
    <header className="border-b-[1.5px] border-ink pb-4"><p className="kicker">Bước 2 / 3</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Dùng điểm và đặt hàng</h1><p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Kiểm tra số tiền dự kiến trước khi chuyển sang cổng thanh toán ZaloPay.</p></header>
    {pendingOrder && <div role="status" className="ticket p-4 text-sm text-navy">Bạn có một đơn đang chờ thanh toán cho các món này. Tiếp tục đơn để chọn hoặc đổi phương thức thanh toán; mã giảm giá và điểm của đơn đã được xác nhận trước đó. <Link href={`/orders/${pendingOrder.id}`} className="font-semibold text-primary underline">Xem chi tiết đơn</Link></div>}
    {items.length === 0 ? <div className="ticket p-8 text-center"><ShoppingBag className="mx-auto text-primary" size={36} /><p className="mt-3 font-semibold text-navy">Chưa có món để đặt.</p><Link href="/menu" className="btn-primary mt-4">Xem thực đơn</Link></div> : <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="ticket h-fit p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-navy">Món đã xác nhận</h2><div className="mt-3 divide-y divide-dashed divide-ink/15">{items.map((item) => <div key={`${item.productId}-${item.size}-${item.toppingIds.join('-')}`} className="flex justify-between gap-4 py-4 text-sm"><div><p className="font-semibold text-navy">{item.productName} × {item.quantity}</p><p className="mt-1 text-content-secondary">Size {item.size}{item.toppingNames.length ? `, ${item.toppingNames.join(', ')}` : ''}</p></div><span className="price shrink-0 font-semibold text-primary">{money(item.estimatedUnitPrice * item.quantity)}</span></div>)}</div></div>
      <aside className="ticket h-fit p-5 sm:p-6"><h2 className="font-display text-lg font-bold text-navy">Mã khuyến mãi</h2>
        <label htmlFor="promotion-code" className="mt-3 block text-sm font-semibold text-navy">Nhập mã khuyến mãi</label>
        <input id="promotion-code" className="field mt-2" value={promotionCode} onChange={(event) => setPromotionCode(event.target.value)} disabled={Boolean(pendingOrder)} maxLength={50} autoComplete="off" />
        {promotionStatus && <p role="status" className="mt-2 text-sm text-content-secondary">{promotionStatus}</p>}
        {!pendingOrder && promotions.length > 0 && <ul className="mt-3 space-y-2">{promotions.map((promotion) => <li key={promotion.code} className="rounded-ticket border border-ink/15 p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong>{promotion.code}</strong><button type="button" onClick={() => setPromotionCode(promotion.code)} className="min-h-11 font-semibold text-primary underline">Chọn mã</button></div><p>{promotion.description || 'Ưu đãi cho đơn hàng'}</p><p className="text-content-secondary">Đơn tối thiểu {money(Number(promotion.minOrderAmount))}{promotion.endDate ? ` · Hết hạn ${new Date(promotion.endDate).toLocaleDateString('vi-VN')}` : ''}</p></li>)}</ul>}
        {selectedPromotion && total < Number(selectedPromotion.minOrderAmount) && <p role="status" className="mt-2 text-sm text-danger">Đơn hàng chưa đạt mức tối thiểu cho mã này.</p>}
        <h2 className="mt-6 flex items-center gap-2 font-display text-lg font-bold text-navy"><BadgePercent size={20} className="text-primary" /> Điểm tích lũy</h2><div className="mt-4 rounded-ticket border border-primary/15 bg-primary-light p-4"><p className="text-xs font-semibold text-content-secondary">Điểm hiện có</p><p className="price mt-1 text-2xl font-extrabold text-primary">{pointsLoading ? 'Đang tải...' : availablePoints === null ? '—' : `${availablePoints.toLocaleString('vi-VN')} điểm`}</p><p className="mt-2 text-sm leading-6 text-content-secondary">{availablePoints === null ? 'Đăng nhập để xem và sử dụng điểm.' : `Dùng tối đa ${maxPoints} điểm cho đơn này.`} 10 điểm giảm 1.000đ.</p></div>
        {availablePoints !== null && <><label htmlFor="points-to-use" className="mt-4 block text-sm font-semibold text-navy">Số điểm muốn dùng</label><input id="points-to-use" type="number" min="0" max={maxPoints} step="10" value={pointsToUse} onChange={(event) => setPointsToUse(Number(event.target.value))} disabled={maxPoints === 0 || Boolean(pendingOrder)} aria-invalid={!validPoints} className="field mt-2 disabled:opacity-50" />{!validPoints && <p className="mt-2 text-sm text-danger">Chọn bội số của 10, tối đa {maxPoints} điểm.</p>}</>}
        {pointsError && <p role="status" className="mt-3 text-sm text-content-secondary">{pointsError}</p>}
        {pendingOrder ? <p className="mt-5 border-t border-dashed border-ink/25 pt-4 font-bold text-navy">Số tiền của đơn: {pendingOrder.finalAmount === undefined ? 'Xem chi tiết đơn' : money(pendingOrder.finalAmount)}</p> : <div className="mt-5 space-y-2 border-t border-dashed border-ink/25 pt-4 text-sm"><p className="flex justify-between gap-3"><span className="text-content-secondary">Tạm tính</span><span className="price">{money(total)}</span></p><p className="flex justify-between gap-3"><span className="text-content-secondary">Giảm bằng điểm</span><span className="price">{pointsDiscount > 0 ? `-${money(pointsDiscount)}` : money(0)}</span></p><p className="mt-2 flex items-baseline justify-between gap-3 border-t-[1.5px] border-ink pt-3 text-base font-bold text-navy"><span>Dự kiến thanh toán</span><span className="price font-display text-xl font-extrabold text-primary">{money(total - promotionDiscount - pointsDiscount)}</span></p></div>}
        <p className="mt-3 text-xs leading-5 text-content-secondary">Giá chính xác được tính khi tạo đơn. Điểm sẽ được hoàn nếu bạn hủy đơn trước khi thanh toán.</p>
        {error && <p role="alert" className="mt-4 rounded-ticket border-l-4 border-danger bg-danger-light p-3 text-sm text-danger">{error} Nếu kết nối bị ngắt, hãy kiểm tra <Link href="/orders" className="font-semibold underline">lịch sử đơn hàng</Link> trước khi thử lại.</p>}
        <button type="button" onClick={() => void placeOrder()} disabled={busy || cooldown.blocked || !ready || !validPoints || items.length > 50} className="btn-primary mt-5 w-full disabled:opacity-50">{busy ? 'Đang xử lý...' : cooldown.label || (pendingOrder ? 'Tiếp tục chọn phương thức' : 'Đặt hàng và thanh toán')}</button>
      </aside>
    </div>}
  </section>;
}
