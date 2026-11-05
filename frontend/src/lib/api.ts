const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
export const API_BASE_URL = rawBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const incomingHeaders = (options.headers || {}) as Record<string, string>;
  const headers = getAuthHeaders(incomingHeaders);

  return fetch(url, {
    ...options,
    headers,
  });
}

