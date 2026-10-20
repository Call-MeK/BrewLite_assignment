import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
      <div className="inline-flex items-center gap-2 bg-coffee-cream/80 text-navy text-xs font-semibold px-4 py-1.5 rounded-full border border-border-light shadow-sm">
        <span>☕</span>
        <span>Hệ thống đặt cà phê không tiền mặt thế hệ mới</span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-black text-navy tracking-tight max-w-2xl leading-tight">
        Đặt đồ uống nhanh chóng, thanh toán không chạm
      </h1>

      <p className="max-w-xl text-content-secondary text-base sm:text-lg">
        Giảm thời gian xếp hàng tại quầy. Lựa chọn đồ uống yêu thích, tùy chỉnh size & topping chỉ với vài lượt chạm.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <Link
          href="/menu"
          className="bg-primary hover:bg-primary-hover text-white font-semibold px-7 py-3.5 rounded-xl shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Khám phá Thực đơn
        </Link>
        <Link
          href="/cart"
          className="bg-surface-secondary hover:bg-white text-content-primary border border-border-light font-semibold px-7 py-3.5 rounded-xl transition-all hover:shadow-sm"
        >
          Xem Giỏ hàng
        </Link>
      </div>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl pt-8 text-left">
        <div className="p-4 rounded-xl border border-border-light bg-surface-secondary">
          <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center font-bold mb-2">⚡</div>
          <h3 className="font-bold text-navy text-sm">Đặt hàng tức thì</h3>
          <p className="text-xs text-content-secondary mt-1">Chọn món và gửi đơn chỉ trong vài giây.</p>
        </div>
        <div className="p-4 rounded-xl border border-border-light bg-surface-secondary">
          <div className="w-8 h-8 rounded-lg bg-success-light text-success flex items-center justify-center font-bold mb-2">💳</div>
          <h3 className="font-bold text-navy text-sm">Thanh toán không tiền mặt</h3>
          <p className="text-xs text-content-secondary mt-1">Hỗ trợ ví điện tử và thẻ ngân hàng tiện lợi.</p>
        </div>
        <div className="p-4 rounded-xl border border-border-light bg-surface-secondary">
          <div className="w-8 h-8 rounded-lg bg-coffee-cream text-navy flex items-center justify-center font-bold mb-2">☕</div>
          <h3 className="font-bold text-navy text-sm">Tùy biến món dễ dàng</h3>
          <p className="text-xs text-content-secondary mt-1">Đầy đủ tùy chọn Size (S/M/L) và Topping.</p>
        </div>
      </div>
    </div>
  );
}
