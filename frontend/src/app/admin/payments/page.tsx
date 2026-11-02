'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Building2, CheckCircle2, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, FlaskConical, Landmark, Search, ShieldCheck, SlidersHorizontal,
  RefreshCw, Wallet, X,
} from 'lucide-react';
import { PaymentDetailDialog } from '@/components/payments/payment-detail-dialog';
import { AdminNav } from '@/components/admin-nav';
import {
  formatPaymentMoney as money,
  formatPaymentTime as time, initialFilters, needsPaymentReview, reconciliationLabels,
  sourceLabels, statusLabels,
} from '@/lib/payment-management-demo';
import { ApiError } from '@/lib/api-client';
import { getZaloPayConfig } from '@/services/zalopay.service';
import { getManagedPayment, getManagedPayments } from '@/services/payment-management.service';
import type { ManagedPayment, PaymentFilters, PaymentManagementResult, PaymentSource } from '@/types/payment-management';
import { useRequestCooldown } from '@/components/use-request-cooldown';

const pageSize = 6;
const sources: { value: PaymentSource | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả giao dịch' },
  { value: 'MOCK', label: 'Mock Payment' },
  { value: 'ZALOPAY_SANDBOX', label: 'ZaloPay Sandbox' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
];
const controlClass = 'min-h-11 w-full rounded-xl border border-border-light bg-white px-3 text-sm text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-light bg-white px-4 text-sm font-semibold text-navy transition-colors hover:bg-surface-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40';

function SourceIcon({ source }: { source: PaymentSource }) {
  const Icon = source === 'MOCK' ? FlaskConical : source === 'ZALOPAY_SANDBOX' ? Wallet : Landmark;
  return <Icon size={18} aria-hidden="true" />;
}

function StatusBadge({ payment }: { payment: ManagedPayment }) {
  const review = needsPaymentReview(payment);
  const Icon = review || payment.status === 'FAILED' ? CircleAlert : payment.status === 'SUCCESS' ? CheckCircle2 : Clock3;
  const color = review ? 'bg-amber-50 text-amber-900' : payment.status === 'SUCCESS' ? 'bg-success-light text-success' : payment.status === 'FAILED' ? 'bg-danger-light text-danger' : 'bg-primary-light text-primary';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}><Icon size={13} aria-hidden="true" />{review ? 'Cần kiểm tra' : statusLabels[payment.status]}</span>;
}

export default function PaymentManagementPage() {
  const cooldown = useRequestCooldown('GET', '/admin/payments');
  const detailCooldown = useRequestCooldown('GET', '/admin/payments/:id');
  const reserveRefresh = cooldown.start;
  const [result, setResult] = useState<PaymentManagementResult | null>(null);
  const [filters, setFilters] = useState<PaymentFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<ManagedPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [sandboxConfigured, setSandboxConfigured] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);
  const ready = !loading && !error && !invalidDates && result !== null;
  const pages = Math.max(1, result?.pagination.totalPages ?? 1);
  const currentPage = page;
  const offset = (currentPage - 1) * pageSize;
  const visible = ready ? result.items : [];
  const total = ready ? result.pagination.total : 0;
  const summary = result?.summary ?? { bank: 0, test: 0, pending: 0, attention: 0 };
  const hasFilters = filters.source !== 'ALL' || filters.status !== 'ALL' || Boolean(filters.search || filters.from || filters.to);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    const isCurrent = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    setResult(null);
    setError(null);
    setLoading(!invalidDates);
    if (invalidDates) return () => controller.abort();
    const timer = window.setTimeout(async () => {
      try {
        const [data, config] = await Promise.all([
          getManagedPayments(filters, page, controller.signal),
          getZaloPayConfig(controller.signal).catch(() => ({ enabled: false })),
        ]);
        if (isCurrent()) {
          setSandboxConfigured(config.enabled);
          if (page > Math.max(1, data.pagination.totalPages)) {
            setPage(Math.max(1, data.pagination.totalPages));
          } else {
            setResult(data);
            setSelectedPayment((current) => current ? data.items.find((item) => item.id === current.id) ?? current : null);
          }
        }
      } catch (err) {
        if (isCurrent()) {
          setError(err instanceof ApiError && err.statusCode === 401
            ? 'Vui lòng đăng nhập để quản lý thanh toán.'
            : err instanceof ApiError && err.statusCode === 403
              ? 'Tài khoản chưa được cấp quyền quản lý thanh toán.'
              : 'Không thể tải giao dịch. Kiểm tra kết nối backend rồi thử lại.');
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, page, refresh, invalidDates]);

  useEffect(() => {
    let token = localStorage.getItem('token');
    function onAuthChange() {
      const nextToken = localStorage.getItem('token');
      if (nextToken === token) return;
      token = nextToken;
      detailRequest.current?.abort();
      setSelectedPayment(null);
      setSandboxConfigured(false);
      setDetailLoading(false);
      setDetailError(null);
      setResult(null);
      setError(null);
      setLoading(true);
      setRefresh((value) => value + 1);
    }
    window.addEventListener('auth-changed', onAuthChange);
    window.addEventListener('storage', onAuthChange);
    return () => {
      detailRequest.current?.abort();
      window.removeEventListener('auth-changed', onAuthChange);
      window.removeEventListener('storage', onAuthChange);
    };
  }, []);

  useEffect(() => {
    function refreshVisible() {
      if (document.visibilityState === 'visible' && reserveRefresh()) setRefresh((value) => value + 1);
    }
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [reserveRefresh]);

  function updateFilters(patch: Partial<PaymentFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
  }

  async function openPayment(id: string) {
    if (detailLoading || detailCooldown.blocked || !detailCooldown.start()) return;
    detailRequest.current?.abort();
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    const isCurrent = () => !controller.signal.aborted && localStorage.getItem('token') === token;
    detailRequest.current = controller;
    setDetailError(null);
    setDetailLoading(true);
    try {
      const payment = await getManagedPayment(id, controller.signal);
      if (isCurrent()) setSelectedPayment(payment);
    } catch (err) {
      if (isCurrent()) {
        setDetailError(err instanceof ApiError ? err.message : 'Không thể tải chi tiết giao dịch. Vui lòng thử lại.');
      }
    } finally {
      if (isCurrent()) setDetailLoading(false);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="payments-title">
      <AdminNav />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-content-secondary">
        <p className="flex items-center gap-2"><ShieldCheck size={15} aria-hidden="true" /> BrewLite <span aria-hidden="true">/</span> Quản trị <span aria-hidden="true">/</span> Thanh toán</p>
        <span className="rounded-full border border-border-light bg-white px-3 py-1.5 font-semibold text-primary">MOCK + SANDBOX · Dữ liệu từ backend</span>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Payment management</p>
          <h1 id="payments-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Quản lý thanh toán</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-content-secondary">Theo dõi giao dịch Mock Payment, ZaloPay Sandbox và kiểm tra thông tin đơn hàng.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { if (cooldown.start()) setRefresh((value) => value + 1); }} disabled={loading || invalidDates || cooldown.blocked} className={buttonClass}><RefreshCw size={18} aria-hidden="true" /> {cooldown.label || 'Làm mới'}</button>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-light p-4 text-sm leading-relaxed text-primary">
        <FlaskConical size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p><strong>Giao dịch thử nghiệm từ hệ thống.</strong> Mock Payment và ZaloPay Sandbox không phải doanh thu tiền thật. Thông báo chuyển khoản ngân hàng chưa được kết nối.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-danger/20 bg-danger-light p-4 text-sm text-danger">{error}</div>}
      {detailError && <p role="alert" className="text-sm text-danger">{detailError}</p>}
      {detailLoading && <p role="status" className="text-sm text-content-secondary">Đang tải chi tiết giao dịch…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Chuyển khoản ngân hàng', value: 'Chưa kết nối', caption: 'Chưa nhận thông báo chuyển khoản thật', icon: Landmark, color: 'bg-success-light text-success' },
          { label: 'Thanh toán thử nghiệm thành công', value: ready ? money(summary.test) : '—', caption: 'Mock + sandbox đã khớp đơn theo bộ lọc', icon: Wallet, color: 'bg-primary-light text-primary' },
          { label: 'Giao dịch đang chờ', value: ready ? String(summary.pending).padStart(2, '0') : '—', caption: 'Chờ kết quả thanh toán mô phỏng', icon: Clock3, color: 'bg-surface-secondary text-content-secondary' },
          { label: 'Giao dịch cần chú ý', value: ready ? String(summary.attention).padStart(2, '0') : '—', caption: 'Thất bại hoặc sai số tiền đơn hàng', icon: CircleAlert, color: 'bg-amber-50 text-amber-900' },
        ].map(({ label, value, caption, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-border-light bg-white p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold leading-5 text-content-secondary">{label}</p><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={18} aria-hidden="true" /></span></div><p className="mt-4 text-3xl font-black tracking-tight tabular-nums">{value}</p><p className="mt-2 text-xs leading-5 text-content-secondary">{caption}</p></div>)}
      </div>

      <section aria-labelledby="transactions-title" className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6"><div><h2 id="transactions-title" className="text-lg font-bold">Giao dịch thanh toán</h2><p className="mt-1 text-xs text-content-secondary">Thống kê trên toàn bộ giao dịch khớp bộ lọc · Thời gian GMT+7</p></div><span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-bold text-content-secondary">{ready ? `${total} giao dịch` : '—'}</span></div>

        <div className="flex gap-1 overflow-x-auto border-b border-border-light px-5 sm:px-6" role="group" aria-label="Lọc theo nguồn giao dịch">
          {sources.map((source) => <button key={source.value} type="button" aria-pressed={filters.source === source.value} disabled={cooldown.blocked} onClick={() => { if (cooldown.start()) updateFilters({ source: source.value }); }} className={`min-h-12 shrink-0 border-b-2 px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${filters.source === source.value ? 'border-primary text-primary' : 'border-transparent text-content-secondary hover:text-primary'}`}>{source.label}</button>)}
        </div>

        <div className="space-y-3 p-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr]">
            <label className="block text-xs font-semibold text-content-secondary">Tìm giao dịch<span className="relative mt-2 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-content-secondary" aria-hidden="true" /><input type="search" maxLength={100} placeholder="Mã, đơn hàng, khách hàng…" value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} className={`${controlClass} pl-10`} /></span></label>
            <label className="block text-xs font-semibold text-content-secondary">Trạng thái<select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value as PaymentFilters['status'] })} className={`${controlClass} mt-2`}><option value="ALL">Tất cả trạng thái</option><option value="SUCCESS">Thành công</option><option value="PENDING">Đang chờ</option><option value="FAILED">Thất bại</option><option value="REVIEW">Cần kiểm tra đối soát</option></select></label>
            <label className="block text-xs font-semibold text-content-secondary">Từ ngày<input type="date" value={filters.from} aria-invalid={invalidDates} aria-describedby={invalidDates ? 'payment-date-error' : undefined} onChange={(event) => updateFilters({ from: event.target.value })} className={`${controlClass} mt-2`} /></label>
            <label className="block text-xs font-semibold text-content-secondary">Đến ngày<input type="date" value={filters.to} aria-invalid={invalidDates} aria-describedby={invalidDates ? 'payment-date-error' : undefined} onChange={(event) => updateFilters({ to: event.target.value })} className={`${controlClass} mt-2`} /></label>
          </div>
          {invalidDates && <p id="payment-date-error" role="alert" className="text-sm text-danger">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
          {hasFilters && <button type="button" disabled={cooldown.blocked} onClick={() => { if (cooldown.start()) { setFilters(initialFilters); setPage(1); } }} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X size={14} aria-hidden="true" /> Xóa bộ lọc</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <caption className="sr-only">Danh sách giao dịch thanh toán mô phỏng từ backend, thời gian theo GMT+7. Chọn Xem để mở chi tiết.</caption>
            <thead className="border-y border-border-light bg-surface-secondary text-[11px] uppercase tracking-wider text-content-secondary"><tr>{['Giao dịch / Đơn hàng', 'Nguồn thanh toán', 'Số tiền', 'Trạng thái / Đối soát', 'Thời gian', 'Chi tiết'].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border-light">
              {visible.map((payment) => <tr key={payment.id} className="transition-colors hover:bg-surface-secondary/70">
                <td className="px-5 py-4"><p className="font-semibold">{payment.orderNumber === null ? 'Chưa khớp đơn' : `Đơn #${payment.orderNumber}`}</p><p className="mt-1 text-[11px] text-content-secondary">{payment.id}</p><p className="mt-1 text-xs text-content-secondary">{payment.customer}</p></td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${payment.source === 'BANK_TRANSFER' ? 'bg-success-light text-success' : payment.source === 'ZALOPAY_SANDBOX' ? 'bg-blue-50 text-blue-800' : 'bg-primary-light text-primary'}`}><SourceIcon source={payment.source} /></span><span className="text-xs font-semibold">{sourceLabels[payment.source]}</span></div><p className="mt-1 pl-10 text-[11px] text-content-secondary">{payment.source === 'ZALOPAY_SANDBOX' ? 'Giao dịch sandbox đã lưu' : 'Thanh toán mô phỏng đã lưu'}</p></td>
                <td className="whitespace-nowrap px-5 py-4 font-bold tabular-nums">{money(payment.amount)}</td>
                <td className="px-5 py-4"><StatusBadge payment={payment} /><p className="mt-1.5 text-[11px] text-content-secondary">{reconciliationLabels[payment.reconciliation]}</p></td>
                <td className="whitespace-nowrap px-5 py-4 text-xs tabular-nums text-content-secondary">{time(payment.createdAt)}</td>
                <td className="px-5 py-4"><button type="button" disabled={detailLoading || detailCooldown.blocked} onClick={() => openPayment(payment.id)} aria-label={`Xem chi tiết ${payment.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:bg-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">{detailCooldown.label || 'Xem'} <ArrowRight size={15} aria-hidden="true" /></button></td>
              </tr>)}
              {visible.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center"><Search size={28} className="mx-auto text-primary" aria-hidden="true" /><p role="status" className="mt-3 font-bold">{invalidDates ? 'Khoảng ngày chưa hợp lệ' : loading ? 'Đang tải giao dịch…' : error ? 'Chưa tải được dữ liệu' : 'Không tìm thấy giao dịch'}</p><p className="mt-2 text-sm text-content-secondary">{invalidDates ? 'Điều chỉnh ngày bắt đầu và ngày kết thúc để xem dữ liệu.' : loading ? 'Vui lòng chờ.' : error ? 'Kiểm tra thông báo phía trên và chọn Làm mới để thử lại.' : filters.source === 'BANK_TRANSFER' ? 'Kênh thanh toán này chưa được kết nối.' : 'Thử thay đổi từ khóa hoặc xóa bộ lọc.'}</p></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-light px-5 py-4 sm:px-6">
          <p role="status" aria-live="polite" className="text-xs text-content-secondary">{ready ? `Hiển thị ${visible.length === 0 ? 0 : offset + 1}–${offset + visible.length} / ${total} giao dịch` : 'Chưa có dữ liệu hiển thị'}</p>
          <nav aria-label="Phân trang giao dịch" className="flex items-center gap-2"><button type="button" disabled={!ready || cooldown.blocked || currentPage === 1} onClick={() => { if (cooldown.start()) setPage(currentPage - 1); }} aria-label="Trang giao dịch trước" className={`${buttonClass} px-3`}><ChevronLeft size={17} aria-hidden="true" /></button><span className="px-2 text-xs font-semibold">Trang {currentPage} / {pages}</span><button type="button" disabled={!ready || cooldown.blocked || currentPage >= pages} onClick={() => { if (cooldown.start()) setPage(currentPage + 1); }} aria-label="Trang giao dịch sau" className={`${buttonClass} px-3`}><ChevronRight size={17} aria-hidden="true" /></button></nav>
        </div>
      </section>

      <section aria-labelledby="connections-title" className="space-y-3">
        <div className="flex items-center gap-2"><SlidersHorizontal size={17} className="text-primary" aria-hidden="true" /><h2 id="connections-title" className="text-sm font-bold">Kênh thanh toán</h2></div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { title: 'Mock Payment', icon: FlaskConical, label: 'API đã tích hợp', description: 'Đọc giao dịch mô phỏng đã lưu trong hệ thống. Cần đăng nhập bằng tài khoản được cấp quyền quản trị.' },
            { title: 'ZaloPay Sandbox', icon: Wallet, label: sandboxConfigured ? 'Đã có cấu hình sandbox' : 'Chưa bật hoặc thiếu cấu hình', description: 'Hỗ trợ tạo thanh toán, xác thực callback và đồng bộ trạng thái. Cấu hình đầy đủ chưa đồng nghĩa kết nối đã được kiểm chứng.' },
            { title: 'Chuyển khoản ngân hàng', icon: Building2, label: 'Chưa liên kết', description: 'Cần liên kết ngân hàng và webhook để nhận thông báo tiền thật.' },
          ].map(({ title, icon: Icon, label, description }) => <article key={title} className="rounded-2xl border border-border-light bg-white p-5"><div className="flex items-center gap-2"><Icon size={18} className="shrink-0 text-primary" aria-hidden="true" /><h3 className="text-sm font-bold">{title}</h3></div><p className="mt-3 inline-flex rounded-full bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-content-secondary">{label}</p><p className="mt-3 text-xs leading-5 text-content-secondary">{description}</p></article>)}
        </div>
      </section>

      {selectedPayment && <PaymentDetailDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} onUpdated={(payment) => { setSelectedPayment(payment); setRefresh((value) => value + 1); }} />}
    </section>
  );
}
