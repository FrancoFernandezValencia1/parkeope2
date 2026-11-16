const API = import.meta.env.VITE_API_URL || '';

export async function api(path, opts = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch(API + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch {
    throw new Error('Sin conexión al servidor. Verifica que el backend esté corriendo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-expired'));
      throw new Error(data.error || 'Sesión vencida. Vuelve a entrar.');
    }
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

export const ticketUrl = (id) => `${API}/api/tickets/${id}/ticket`;

export const fmtLima = (d) =>
  d ? new Date(d).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

export const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
