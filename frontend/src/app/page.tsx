import Link from 'next/link';
import { ArrowRight, CreditCard, CupSoda, MousePointerClick, ShoppingBag } from 'lucide-react';

const steps = [
  { icon: CupSoda, number: '01', title: 'Chọn món', description: 'Khám phá thực đơn và tìm ly nước hợp gu.' },
  { icon: MousePointerClick, number: '02', title: 'Tùy chỉnh', description: 'Chọn size, topping và số lượng theo ý bạn.' },
  { icon: CreditCard, number: '03', title: 'Thanh toán', description: 'Hoàn tất đơn hàng nhanh chóng, không cần tiền mặt.' },
];

export default function HomePage() {
  return (
    <div className="space-y-20 pb-8 sm:space-y-24">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy px-6 py-16 text-white sm:px-12 sm:py-20 lg:px-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[54px] border-white/5" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 right-20 h-80 w-80 rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-coffee-cream">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Cà phê ngon, đặt thật nhẹ
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            Ly bạn thích, <span className="text-[#f2c697]">sẵn sàng</span> khi bạn đến.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#f0e3d8] sm:text-lg">
            Chọn đồ uống, thêm topping và thanh toán ngay trên BrewLite. Ít chờ đợi hơn, thêm thời gian tận hưởng cà phê.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/menu" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Xem thực đơn <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/cart" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-6 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <ShoppingBag size={18} aria-hidden="true" /> Xác nhận món đã chọn
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works">
        <div className="mb-8 max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Đơn giản từ đầu đến cuối</p>
          <h2 id="how-it-works" className="mt-3 text-3xl font-black tracking-tight text-navy sm:text-4xl">Ba bước cho một ly cà phê ngon</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, number, title, description }) => (
            <div key={number} className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary"><Icon size={24} aria-hidden="true" /></span>
                <span className="text-sm font-bold text-content-secondary">{number}</span>
              </div>
              <h3 className="mt-7 text-xl font-bold text-navy">{title}</h3>
              <p className="mt-2 leading-6 text-content-secondary">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 rounded-[2rem] bg-primary-light px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between" aria-labelledby="ready-to-order">
        <div>
          <h2 id="ready-to-order" className="text-2xl font-black text-navy sm:text-3xl">Hôm nay bạn uống gì?</h2>
          <p className="mt-2 text-content-secondary">Thực đơn BrewLite đang chờ bạn khám phá.</p>
        </div>
        <Link href="/menu" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-6 font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:self-auto">
          Chọn món ngay <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
