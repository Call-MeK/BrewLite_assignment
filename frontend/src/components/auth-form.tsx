'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api-client';

interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
  loyaltyPoints: number;
}

interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnPath, setReturnPath] = useState('/');
  const isRegister = mode === 'register';

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next === '/cart' || next === '/checkout' || next === '/orders') setReturnPath(next);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (isRegister && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await fetchApi<AuthResult>(
        isRegister ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
            ...(isRegister ? { fullName: fullName.trim() } : {}),
          }),
        },
      );
      localStorage.setItem('token', result.accessToken);
      window.dispatchEvent(new Event('auth-changed'));
      router.replace(returnPath);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác thực tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border-light bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-navy">
        {isRegister ? 'Tạo tài khoản BrewLite' : 'Đăng nhập BrewLite'}
      </h1>
      <p className="mt-2 text-sm text-content-secondary">
        {isRegister
          ? 'Tạo tài khoản để đặt đồ uống và tích lũy điểm.'
          : 'Đăng nhập để tiếp tục đặt đồ uống.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {isRegister && (
          <label className="block text-sm font-medium text-navy">
            Họ và tên
            <input
              className="mt-1 block w-full rounded-lg border border-border-light px-3 py-2 text-content-primary outline-none focus:border-primary"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
        )}
        <label className="block text-sm font-medium text-navy">
          Email
          <input
            className="mt-1 block w-full rounded-lg border border-border-light px-3 py-2 text-content-primary outline-none focus:border-primary"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-navy">
          Mật khẩu
          <input
            className="mt-1 block w-full rounded-lg border border-border-light px-3 py-2 text-content-primary outline-none focus:border-primary"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
        {isRegister && (
          <label className="block text-sm font-medium text-navy">
            Xác nhận mật khẩu
            <input
              className="mt-1 block w-full rounded-lg border border-border-light px-3 py-2 text-content-primary outline-none focus:border-primary"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {isSubmitting ? 'Đang xử lý...' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-content-secondary">
        {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
        <Link href={`${isRegister ? '/login' : '/register'}${returnPath !== '/' ? `?next=${encodeURIComponent(returnPath)}` : ''}`} className="font-semibold text-primary hover:underline">
          {isRegister ? 'Đăng nhập' : 'Đăng ký'}
        </Link>
      </p>
    </section>
  );
}
