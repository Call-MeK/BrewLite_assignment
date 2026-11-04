'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, fetchApi } from '@/lib/api-client';
import { useRequestCooldown } from '@/components/use-request-cooldown';

interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    loyaltyPoints: number;
  };
}

export default function SecurityPage() {
  const cooldown = useRequestCooldown('POST', '/auth/change-password');
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(localStorage.getItem('token')));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || cooldown.blocked) return;
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (!cooldown.start()) return;
    setIsSubmitting(true);
    try {
      const result = await fetchApi<AuthResult>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      localStorage.setItem('token', result.accessToken);
      window.dispatchEvent(new Event('auth-changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Đã đổi mật khẩu. Các phiên đăng nhập cũ đã hết hiệu lực.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 401) {
        setError('Mật khẩu hiện tại không đúng hoặc phiên đăng nhập đã hết hiệu lực.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Không thể đổi mật khẩu');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasToken === null) return null;
  if (!hasToken) {
    return (
      <section className="ticket mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-navy">Bảo mật tài khoản</h1>
        <p className="mt-3 text-content-secondary">Bạn cần đăng nhập để đổi mật khẩu.</p>
        <Link href="/login" className="mt-5 inline-block font-semibold text-primary hover:underline">
          Đăng nhập
        </Link>
      </section>
    );
  }

  return (
    <section className="ticket mx-auto max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-navy">Đổi mật khẩu</h1>
      <p className="mt-2 text-sm text-content-secondary">
        Sau khi đổi mật khẩu, các token cũ sẽ không còn truy cập được tài khoản.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-navy">
          Mật khẩu hiện tại
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            minLength={6}
            required
            className="field mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-navy">
          Mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={6}
            required
            className="field mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-navy">
          Xác nhận mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={6}
            required
            className="field mt-1"
          />
        </label>
        {error && <p role="alert" className="rounded-ticket border-l-4 border-danger bg-danger-light p-3 text-sm text-danger">{error}</p>}
        {message && <p role="status" className="rounded-ticket border-l-4 border-success bg-success-light p-3 text-sm text-success">{message}</p>}
        <button
          type="submit"
          disabled={isSubmitting || cooldown.blocked}
          className="btn-primary w-full disabled:opacity-60"
        >
          {isSubmitting ? 'Đang xử lý...' : cooldown.label || 'Đổi mật khẩu'}
        </button>
      </form>
    </section>
  );
}
