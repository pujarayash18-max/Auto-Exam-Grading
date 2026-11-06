import { API_BASE_URL } from './api';

export async function performLogout() {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Logout error:', err);
  }

  // Clear all local & session storage
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {}

  // Expire cookies via JavaScript
  document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';

  // Force hard navigation to login with logged_out flag so Next.js middleware clears edge cookies
  window.location.href = '/auth/login?logged_out=1';
}

