import { blockRequestCooldown } from './request-cooldown';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> & { message?: string | string[]; retryAfter?: number } = await response.json();

  if (!response.ok || !json.success) {
    const message = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    let retryAfter: number | undefined;
    if (response.status === 429) {
      const value = Number(response.headers.get('Retry-After') || json.retryAfter || 15);
      retryAfter = Number.isFinite(value) && value > 0 ? Math.ceil(value) : 15;
      blockRequestCooldown(options.method || 'GET', endpoint, retryAfter);
    }
    throw new ApiError(message || 'Có lỗi xảy ra khi gọi API', response.status, retryAfter);
  }

  return json.data;
}
