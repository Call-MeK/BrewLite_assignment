'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useRequestCooldown } from '@/components/use-request-cooldown';
import { ApiError } from '@/lib/api-client';
import { getManagedUsers, getUserAccess, setUserRole, userRoleLabels, type UserRole, type UsersResult } from '@/services/user-management.service';

const control = 'min-h-11 rounded-ticket border border-ink/20 bg-white px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
const button = `${control} inline-flex items-center justify-center gap-2 font-semibold text-primary hover:border-ink hover:bg-paper disabled:cursor-not-allowed`;
const date = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
const errorMessage = (error: unknown) => error instanceof ApiError && error.statusCode === 401 ? 'Vui lòng đăng nhập để quản lý khách hàng.'
  : error instanceof ApiError && error.statusCode === 403 ? 'Tài khoản chưa được cấp quyền quản trị.'
    : error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.';

export default function UserManagementPage() {
  const [result, setResult] = useState<UsersResult | null>(null);
  const [myId, setMyId] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const writes = useRequestCooldown('PATCH', '/admin/users/:id/role');
  const refresh = useRequestCooldown('GET', '/admin/users');

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const token = localStorage.getItem('token');
    setResult(null); setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const [data, me] = await Promise.all([getManagedUsers(page, search, role, controller.signal), getUserAccess(controller.signal)]);
        if (controller.signal.aborted || localStorage.getItem('token') !== token) return;
        setMyId(me.id);
        if (page > Math.max(1, data.pagination.totalPages)) setPage(Math.max(1, data.pagination.totalPages));
        else setResult(data);
      } catch (cause) {
        if (!controller.signal.aborted && localStorage.getItem('token') === token) setError(errorMessage(cause));
      } finally {
        if (!controller.signal.aborted && localStorage.getItem('token') === token) setLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, role, reload]);

  useEffect(() => {
    let token = localStorage.getItem('token');
    const onAuth = () => {
      const next = localStorage.getItem('token');
      if (next === token) return;
      token = next; request.current?.abort(); setResult(null); setMyId(''); setMessage(''); setSaving(''); setPage(1); setReload(value => value + 1);
    };
    window.addEventListener('auth-changed', onAuth); window.addEventListener('storage', onAuth);
    return () => { window.removeEventListener('auth-changed', onAuth); window.removeEventListener('storage', onAuth); };
  }, []);

  async function changeRole(id: string, next: UserRole) {
    if (saving || !writes.start()) return;
    const token = localStorage.getItem('token');
    setSaving(id); setError(''); setMessage('');
    try {
      await setUserRole(id, next);
      if (localStorage.getItem('token') !== token) return;
      setMessage(`Đã cập nhật quyền: ${userRoleLabels[next]}.`); setReload(value => value + 1);
    } catch (cause) {
      if (localStorage.getItem('token') === token) {
        setError(errorMessage(cause));
        if (cause instanceof ApiError && [401, 403].includes(cause.statusCode)) setResult(null);
      }
    } finally { if (localStorage.getItem('token') === token) setSaving(''); }
  }

  const pages = Math.max(1, result?.pagination.totalPages ?? 1);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="border-b-[1.5px] border-ink pb-5">
      <p className="kicker">Sổ quản trị · Khách hàng</p>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl"><ShieldCheck size={26} aria-hidden="true" /> Quản lý khách hàng</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Xem tài khoản khách hàng và quản lý quyền truy cập.</p>
    </header>
    {error && <p role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-4 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-ticket border-l-4 border-success bg-success-light p-4 text-sm text-success">{message}</p>}
    <section aria-labelledby="users-title" className="ticket overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6"><h2 id="users-title" className="flex items-center gap-2 font-bold"><Users size={20} className="text-primary" /> Danh sách tài khoản <span className="text-sm font-normal text-content-secondary">({result?.pagination.total ?? 0})</span></h2>
        <button type="button" disabled={loading || Boolean(saving) || refresh.blocked} onClick={() => { if (refresh.start()) setReload(value => value + 1); }} className={button}><RefreshCw size={16} /> {refresh.label || 'Làm mới'}</button>
      </div>
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1fr_220px] sm:px-6">
        <label className="text-xs font-semibold text-content-secondary">Tìm khách hàng<span className="relative mt-2 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-content-secondary" /><input type="search" maxLength={100} placeholder="Tên hoặc email…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className={`${control} w-full pl-10`} /></span></label>
        <label className="text-xs font-semibold text-content-secondary">Quyền truy cập<select value={role} onChange={event => { setRole(event.target.value); setPage(1); }} className={`${control} mt-2 w-full`}><option value="ALL">Tất cả quyền</option><option value="CUSTOMER">Khách hàng</option><option value="ADMIN">Quản trị viên</option></select></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
        <caption className="sr-only">Danh sách khách hàng và quyền truy cập</caption>
        <thead className="border-b border-ink/15 bg-paper-deep/50 text-[11px] uppercase tracking-[0.12em] text-content-secondary"><tr>{['Khách hàng', 'Quyền', 'Điểm tích lũy', 'Đơn hàng', 'Ngày tham gia', 'Phân quyền'].map(label => <th key={label} scope="col" className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink/10">{result?.items.map(user => <tr key={user.id} className="transition-colors hover:bg-paper/60">
          <td className="px-5 py-4"><p className="font-semibold">{user.fullName || 'Chưa cập nhật tên'} {user.id === myId && <span className="text-xs text-primary">(Bạn)</span>}</p><p className="mt-1 text-xs text-content-secondary">{user.email}</p></td>
          <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-ticket border px-2.5 py-1 text-xs font-semibold ${user.role === 'ADMIN' ? 'border-primary/30 bg-primary-light text-primary' : 'border-ink/15 bg-paper text-content-secondary'}`}>{userRoleLabels[user.role]}</span></td>
          <td className="px-5 py-4 tabular-nums">{user.loyaltyPoints.toLocaleString('vi-VN')}</td><td className="px-5 py-4 tabular-nums">{user.orderCount}</td><td className="whitespace-nowrap px-5 py-4 text-xs text-content-secondary">{date(user.createdAt)}</td>
          <td className="px-5 py-4"><select aria-label={`Quyền của ${user.email}`} title={user.id === myId ? 'Không thể tự thay đổi quyền của mình' : undefined} value={user.role} disabled={user.id === myId || Boolean(saving) || writes.blocked} onChange={event => void changeRole(user.id, event.target.value as UserRole)} className={control}><option value="CUSTOMER">Khách hàng</option><option value="ADMIN">Quản trị viên</option></select>{saving === user.id && <p className="mt-1 text-xs text-content-secondary">Đang lưu…</p>}</td>
        </tr>)}{!result?.items.length && <tr><td colSpan={6} role="status" className="px-5 py-12 text-center text-content-secondary">{loading ? 'Đang tải khách hàng…' : error ? 'Chưa tải được danh sách khách hàng.' : 'Không tìm thấy khách hàng phù hợp.'}</td></tr>}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-5 py-4"><p aria-live="polite" className="text-xs text-content-secondary">{result ? `${result.pagination.total} tài khoản · Trang ${page}/${pages}` : 'Chưa có dữ liệu hiển thị'}</p><nav aria-label="Phân trang khách hàng" className="flex gap-2"><button type="button" aria-label="Trang khách hàng trước" disabled={loading || !result || page <= 1} onClick={() => setPage(page - 1)} className={button}><ChevronLeft size={18} /></button><button type="button" aria-label="Trang khách hàng sau" disabled={loading || !result || page >= pages} onClick={() => setPage(page + 1)} className={button}><ChevronRight size={18} /></button></nav></div>
    </section>
    <p className="text-xs text-content-secondary">Quản trị viên có thể quản lý khách hàng và thanh toán. Bạn không thể tự thay đổi quyền của mình.</p>
  </div>;
}
