import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, Coffee, CreditCard, CupSoda, MousePointerClick, ShoppingBag } from 'lucide-react';

const steps = [
  {
    icon: CupSoda,
    number: '01',
    title: 'Chọn món',
    description: 'Xem thực đơn, lọc theo loại đồ uống và thêm món vào túi.',
  },
  {
    icon: MousePointerClick,
    number: '02',
    title: 'Tùy chỉnh',
    description: 'Chọn size, topping và số lượng. Giá cập nhật ngay khi bạn đổi.',
  },
  {
    icon: CreditCard,
    number: '03',
    title: 'Thanh toán',
    description: 'Dùng điểm tích lũy nếu có, trả bằng ZaloPay và nhận tại quầy.',
  },
];

const showcase = [
  { src: '/images/menu/ca-phe-sua-da.jpg', name: 'Cà phê sữa đá', price: '35.000đ' },
  { src: '/images/menu/tra-sua.jpg', name: 'Trà sữa truyền thống', price: '39.000đ' },
  { src: '/images/menu/cold-brew-cam.jpg', name: 'Cold brew cam', price: '46.000đ' },
];

export default function HomePage() {
  return (
    <div className="space-y-16 sm:space-y-24">
      <section className="grid overflow-hidden rounded-ticket border-[1.5px] border-ink bg-white lg:grid-cols-[1.02fr_0.98fr]">
        <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
          <div className="animate-rise">
            <p className="kicker inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-accent" aria-hidden="true" />
              Quán cà phê đặt trước
            </p>
            <h1 className="mt-6 max-w-lg text-[2.6rem] font-extrabold leading-[0.96] tracking-[-0.035em] text-ink sm:text-6xl">
              Một ly đúng gu, sẵn sàng khi bạn tới.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-content-secondary">
              Chọn đồ uống, thêm topping và thanh toán online. Bạn tới quầy, đọc số vé, nhận ly — không xếp hàng,
              không cần tiền mặt.
            </p>
          </div>

          <div className="mt-10 animate-rise [animation-delay:120ms]">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn-primary">
                Xem thực đơn <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="#cach-hoat-dong" className="btn-outline">
                Cách hoạt động
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-content-secondary">
              <li className="inline-flex items-center gap-2">
                <Check size={15} className="text-success" aria-hidden="true" /> Thanh toán ZaloPay
              </li>
              <li className="inline-flex items-center gap-2">
                <Check size={15} className="text-success" aria-hidden="true" /> Tích điểm mỗi đơn
              </li>
            </ul>
          </div>
        </div>

        <div className="relative min-h-[380px] border-t-[1.5px] border-ink lg:min-h-[540px] lg:border-l-[1.5px] lg:border-t-0">
          <Image
            src="/images/hero/phin-coffee.jpg"
            alt="Cà phê nhỏ giọt bằng phin trên ly thủy tinh"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 560px"
            className="object-cover object-[50%_62%]"
          />
          <div className="absolute left-4 top-4 rounded-ticket border border-ink/30 bg-paper/90 px-3 py-1 text-xs font-semibold text-ink backdrop-blur">
            Phin nhỏ giọt, ủ 4 phút
          </div>

          <div className="ticket absolute bottom-5 left-4 right-4 max-w-[17rem] rotate-[-2deg] p-4 animate-stamp [animation-delay:260ms] sm:left-6 sm:right-auto">
            <div className="flex items-start justify-between border-b border-dashed border-ink/30 pb-3">
              <div>
                <p className="text-[0.68rem] font-semibold text-content-secondary">Vé nhận món</p>
                <p className="font-display text-2xl font-extrabold leading-tight">A-017</p>
              </div>
              <Coffee size={20} className="mt-1 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-3 font-semibold text-ink">Cà phê sữa đá</p>
            <p className="text-sm text-content-secondary">Size M, ít đá</p>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-content-secondary">Đã thanh toán</span>
              <span className="price font-bold text-ink">35.000đ</span>
            </div>
          </div>
        </div>
      </section>

      <section id="cach-hoat-dong" aria-labelledby="how-it-works">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b-[1.5px] border-ink pb-4 sm:flex-row sm:items-end">
          <h2 id="how-it-works" className="max-w-md text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">
            Ba bước, một ly cà phê
          </h2>
          <p className="max-w-xs text-sm leading-6 text-content-secondary">
            Toàn bộ đơn hàng diễn ra trên điện thoại. Quầy chỉ việc pha và gọi số vé.
          </p>
        </div>

        <ol className="grid gap-px border border-ink/15 bg-ink/15 md:grid-cols-3">
          {steps.map(({ icon: Icon, number, title, description }) => (
            <li key={number} className="bg-paper p-6 sm:p-8">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-ticket bg-primary-light text-primary">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="price font-display text-2xl font-extrabold text-ink/20">{number}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-content-secondary">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="showcase">
        <div className="mb-6 flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-4">
          <h2 id="showcase" className="text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">
            Hôm nay quán có gì
          </h2>
          <Link href="/menu" className="link-underline shrink-0 text-sm font-semibold text-ink">
            Xem tất cả
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {showcase.map((item) => (
            <Link
              key={item.name}
              href="/menu"
              className="group ticket overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-ticket-hover"
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b-[1.5px] border-ink/15">
                <Image
                  src={item.src}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <span className="font-semibold text-ink">{item.name}</span>
                <span className="price shrink-0 text-sm font-bold text-primary">{item.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-ticket border-[1.5px] border-ink bg-primary text-paper">
        <div className="grid items-center gap-6 p-7 sm:p-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Đặt trước, tới lấy, đi tiếp.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-paper/80">
              Thực đơn 8 món, tùy chỉnh size và topping. Đơn của bạn được giữ trong 15 phút sau khi thanh toán.
            </p>
          </div>
          <Link href="/menu" className="btn bg-accent text-ink hover:bg-accent-soft">
            Chọn món ngay <ShoppingBag size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
