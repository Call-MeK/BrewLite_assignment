import { fetchApi } from '@/lib/api-client';

export type UserRole = 'CUSTOMER' | 'ADMIN';
export interface ManagedUser {
  id: string;
  email: string;
  fullName: string | null;
  loyaltyPoints: number;
  role: UserRole;
  createdAt: string;
  orderCount: number;
}
export interface UsersResult {
  items: ManagedUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export const userRoleLabels: Record<UserRole, string> = { CUSTOMER: 'Khách hàng', ADMIN: 'Quản trị viên' };
export function getUserAccess(signal?: AbortSignal) {
  return fetchApi<{ id: string; role: UserRole }>('/admin/users/me', { signal, cache: 'no-store' });
}
export function getManagedUsers(page: number, search: string, role: string, signal?: AbortSignal) {
  return fetchApi<UsersResult>(`/admin/users?${new URLSearchParams({ page: String(page), limit: '10', search, role })}`, { signal, cache: 'no-store' });
}
export function setUserRole(id: string, role: UserRole) {
  return fetchApi<Omit<ManagedUser, 'orderCount'>>(`/admin/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: JSON.stringify({ role }), cache: 'no-store' });
}
