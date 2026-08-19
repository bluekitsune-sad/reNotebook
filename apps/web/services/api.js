const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('synced_notepad_token');
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || 'Request failed');
  }

  return res.json();
}
