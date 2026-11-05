export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;
    // When accessed via Cloudflare Tunnel, public IP, custom domain, or local dev:
    // always use origin so that /api requests are routed cleanly without Mixed Content or CORS issues
    if (
      protocol === 'https:' ||
      (hostname !== 'localhost' && hostname !== '127.0.0.1') ||
      port === '80' ||
      port === '' ||
      port === '3000'
    ) {
      return origin;
    }
  }
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
  return rawBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
}

export const API_BASE_URL = {
  toString: () => getApiBaseUrl(),
  valueOf: () => getApiBaseUrl(),
  [Symbol.toPrimitive]: () => getApiBaseUrl(),
} as unknown as string;

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

