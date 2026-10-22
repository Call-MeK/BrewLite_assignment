'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, fetchApi } from '@/lib/api-client';

interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
  loyaltyPoints: number;
}

export function AuthNav() {
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const profile = await fetchApi<PublicUser>('/auth/me');
        if (localStorage.getItem('token') === token) setUser(profile);
      } catch (cause) {
        if (localStorage.getItem('token') === token) {
          if (cause instanceof ApiError && cause.statusCode === 401) {
            localStorage.removeItem('token');
          }
          setUser(null);
        }
      }
    }
    void loadUser();
    window.addEventListener('auth-changed', loadUser);
    window.addEventListener('storage', loadUser);
    return () => {
      window.removeEventListener('auth-changed', loadUser);
      window.removeEventListener('storage', loadUser);
    };
  }, []);

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    window.dispatchEvent(new Event('auth-changed'));
  }

  if (user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden font-medium text-navy sm:inline">Xin chào, {user.fullName || user.email}</span>
        <Link href="/account/security" className="font-semibold text-primary hover:underline">
          Đổi mật khẩu
        </Link>
        <button type="button" onClick={logout} className="font-semibold text-primary hover:underline">
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/login" className="font-semibold text-primary hover:underline">Đăng nhập</Link>
      <Link href="/register" className="rounded-lg bg-primary px-3 py-2 font-semibold text-white hover:bg-primary-hover">
        Đăng ký
      </Link>
    </div>
  );
}
