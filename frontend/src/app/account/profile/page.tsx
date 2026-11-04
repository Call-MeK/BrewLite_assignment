'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { ApiError, fetchApi } from '@/lib/api-client';
import { useRequestCooldown } from '@/components/use-request-cooldown';

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  loyaltyPoints: number;
}

export default function ProfilePage() {
  const cooldown = useRequestCooldown('PUT', '/auth/me');
  const retryCooldown = useRequestCooldown('GET', '/auth/me');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    let active = true;
    fetchApi<Profile>('/auth/me').then((user) => {
      if (!active) return;
      setProfile(user);
      setFullName(user.fullName ?? '');
      setEmail(user.email);
    }).catch((cause) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.statusCode === 401) setUnauthorized(true);
      else setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving || cooldown.blocked) return;
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }
    const emailChanged = email.trim().toLowerCase() !== profile.email;
    if (emailChanged && !currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại để đổi email.');
      return;
    }
    if (!cooldown.start()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await fetchApi<{ accessToken: string; user: Profile }>('/auth/me', {
        method: 'PUT', body: JSON.stringify({
          fullName: fullName.trim(), email: email.trim(),
          ...(emailChanged ? { currentPassword } : {}),
        }),
      });
      localStorage.setItem('token', result.accessToken);
      window.dispatchEvent(new Event('auth-changed'));
      setProfile(result.user);
      setFullName(result.user.fullName ?? '');
      setEmail(result.user.email);
      setCurrentPassword('');
      setMessage('Đã cập nhật thông tin cá nhân.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 401) setUnauthorized(true);
      else setError(cause instanceof Error ? cause.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="mx-auto max-w-4xl space-y-6">
    <header className="border-b-[1.5px] border-ink pb-4">
      <p className="kicker">Tài khoản BrewLite</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-ink sm:text-4xl">Hồ sơ của bạn</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-content-secondary">Xem thông tin cá nhân và cập nhật tên, email của bạn.</p>
    </header>

    {unauthorized ? <div className="ticket p-8 text-center">
      <p className="text-content-secondary">Đăng nhập để xem và chỉnh sửa hồ sơ.</p>
      <Link href="/login" className="btn-primary mt-5">Đăng nhập</Link>
    </div> : loading ? <p role="status" className="ticket p-8 text-content-secondary">Đang tải hồ sơ...</p> : !profile ? <div role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-6 text-danger">
      {error || 'Không thể tải hồ sơ.'} <button type="button" disabled={retryCooldown.blocked} onClick={() => { if (retryCooldown.start()) window.location.reload(); }} className="font-semibold underline">{retryCooldown.label || 'Thử lại'}</button>
    </div> : <div className="grid gap-6 md:grid-cols-[1fr_250px]">
      <div className="ticket p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-navy">Thông tin cá nhân</h2>
        <p className="mt-1 text-sm text-content-secondary">Email cũng được dùng để đăng nhập.</p>
        <form onSubmit={(event) => void saveProfile(event)} className="mt-6 space-y-5">
          <label className="block text-sm font-semibold text-navy">Họ và tên
            <input value={fullName} maxLength={100} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required className="field mt-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-navy">Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="field mt-2 font-normal" />
          </label>
          {email.trim().toLowerCase() !== profile.email && <label className="block text-sm font-semibold text-navy">Mật khẩu hiện tại để đổi email
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" minLength={6} required className="field mt-2 font-normal" />
          </label>}
          {error && <p role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-3 text-sm text-danger">{error}</p>}
          {message && <p role="status" className="rounded-ticket border-l-4 border-success bg-success-light p-3 text-sm text-success">{message}</p>}
          <button type="submit" disabled={saving || cooldown.blocked} className="btn-primary px-6 disabled:opacity-60">{saving ? 'Đang lưu...' : cooldown.label || 'Lưu thay đổi'}</button>
        </form>
      </div>
      <aside className="ticket h-fit p-6">
        <CircleUserRound size={36} className="text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-bold text-navy">{profile.fullName || profile.email}</h2>
        <p className="mt-1 break-all text-sm text-content-secondary">{profile.email}</p>
        <p className="mt-5 rounded-ticket border border-primary/15 bg-primary-light p-3 text-sm font-semibold text-primary">Điểm tích lũy: <span className="price">{profile.loyaltyPoints}</span><span className="mt-1 block text-xs font-normal text-content-secondary">10 điểm giảm 1.000đ khi đặt hàng</span></p>
        <Link href="/account/security" className="btn-quiet mt-5 w-full text-sm">Đổi mật khẩu</Link>
        <Link href="/orders" className="mt-2 flex min-h-11 items-center justify-center text-sm font-semibold text-primary hover:underline">Lịch sử đơn hàng</Link>
      </aside>
    </div>}
  </section>;
}
