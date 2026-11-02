'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleUserRound } from 'lucide-react';
import { ApiError, fetchApi } from '@/lib/api-client';
import { getUserAccess } from '@/services/user-management.service';

interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
  loyaltyPoints: number;
}

export function AuthNav() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setAdmin(false);
        return;
      }
      try {
        const [profile, access] = await Promise.all([fetchApi<PublicUser>('/auth/me'), getUserAccess().catch(() => null)]);
        if (localStorage.getItem('token') === token) { setUser(profile); setAdmin(access?.role === 'ADMIN'); }
      } catch (cause) {
        if (localStorage.getItem('token') === token) {
          if (cause instanceof ApiError && cause.statusCode === 401) {
            localStorage.removeItem('token');
          }
          setUser(null);
          setAdmin(false);
        }
      }
    }
    void loadUser();
    window.addEventListener('auth-changed', loadUser);
    window.addEventListener('storage', loadUser);
    window.addEventListener('focus', loadUser);
    return () => {
      window.removeEventListener('auth-changed', loadUser);
      window.removeEventListener('storage', loadUser);
      window.removeEventListener('focus', loadUser);
    };
  }, []);

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    setAdmin(false);
    window.dispatchEvent(new Event('auth-changed'));
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {admin && <Link href="/admin/users" className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-primary hover:bg-primary-light">Quản trị</Link>}
        <Link href="/account/profile" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-light px-3 font-semibold text-navy hover:bg-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <CircleUserRound size={19} aria-hidden="true" /> Hồ sơ
        </Link>
        <button type="button" onClick={logout} className="min-h-11 rounded-lg px-2 font-semibold text-primary hover:underline">
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
