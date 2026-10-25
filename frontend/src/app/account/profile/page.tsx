'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { ApiError, fetchApi } from '@/lib/api-client';

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  loyaltyPoints: number;
}

export default function ProfilePage() {
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
    if (!profile) return;
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }
    const emailChanged = email.trim().toLowerCase() !== profile.email;
    if (emailChanged && !currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại để đổi email.');
      return;
    }
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
    <div className="rounded-[2rem] bg-navy p-7 text-white sm:p-10">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-coffee-cream">Tài khoản BrewLite</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Hồ sơ của bạn</h1>
      <p className="mt-3 text-[#f0e3d8]">Xem thông tin cá nhân và cập nhật tên, email của bạn.</p>
    </div>

    {unauthorized ? <div className="rounded-2xl border border-border-light bg-white p-8 text-center">
      <p className="text-content-secondary">Đăng nhập để xem và chỉnh sửa hồ sơ.</p>
      <Link href="/login" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">Đăng nhập</Link>
    </div> : loading ? <p role="status" className="rounded-2xl bg-white p-8 text-content-secondary">Đang tải hồ sơ...</p> : !profile ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
      {error || 'Không thể tải hồ sơ.'} <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Thử lại</button>
    </div> : <div className="grid gap-6 md:grid-cols-[1fr_250px]">
      <div className="rounded-2xl border border-border-light bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-navy">Thông tin cá nhân</h2>
        <p className="mt-1 text-sm text-content-secondary">Email cũng được dùng để đăng nhập.</p>
        <form onSubmit={(event) => void saveProfile(event)} className="mt-6 space-y-5">
          <label className="block text-sm font-semibold text-navy">Họ và tên
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required className="mt-2 block min-h-12 w-full rounded-xl border border-border-light px-4 font-normal text-content-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="block text-sm font-semibold text-navy">Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-2 block min-h-12 w-full rounded-xl border border-border-light px-4 font-normal text-content-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </label>
          {email.trim().toLowerCase() !== profile.email && <label className="block text-sm font-semibold text-navy">Mật khẩu hiện tại để đổi email
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" minLength={6} required className="mt-2 block min-h-12 w-full rounded-xl border border-border-light px-4 font-normal text-content-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </label>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-success-light p-3 text-sm text-success">{message}</p>}
          <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-primary px-6 font-bold text-white hover:bg-primary-hover disabled:opacity-60">{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </form>
      </div>
      <aside className="h-fit rounded-2xl border border-border-light bg-white p-6 shadow-sm">
        <CircleUserRound size={36} className="text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-bold text-navy">{profile.fullName || profile.email}</h2>
        <p className="mt-1 break-all text-sm text-content-secondary">{profile.email}</p>
        <p className="mt-5 rounded-xl bg-primary-light p-3 text-sm font-semibold text-primary">Điểm tích lũy: {profile.loyaltyPoints}<span className="mt-1 block text-xs font-normal text-content-secondary">10 điểm giảm 1.000đ khi đặt hàng</span></p>
        <Link href="/account/security" className="mt-5 block min-h-11 rounded-xl border border-border-light px-4 py-3 text-center text-sm font-semibold text-navy hover:bg-surface-secondary">Đổi mật khẩu</Link>
        <Link href="/orders" className="mt-2 block min-h-11 rounded-xl border border-border-light px-4 py-3 text-center text-sm font-semibold text-primary hover:underline">Lịch sử đơn hàng</Link>
      </aside>
    </div>}
  </section>;
}
