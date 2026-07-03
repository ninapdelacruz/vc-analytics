const SESSION_KEY = 'vc_admin_session';

export interface AdminSession {
  token: string;
  expiresAt: string;
}

export function getStoredSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed.token || !parsed.expiresAt) return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AdminSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

function authHeaders(session: AdminSession): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
}

export async function verifyAccessCode(codigo: string, modulo: string): Promise<AdminSession> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo, modulo }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'Código incorrecto');
  }
  const session: AdminSession = { token: data.token, expiresAt: data.expiresAt };
  setStoredSession(session);
  return session;
}

export async function validateStoredSession(): Promise<boolean> {
  const session = getStoredSession();
  if (!session) return false;
  try {
    const res = await fetch('/api/auth/session', { headers: authHeaders(session) });
    if (!res.ok) {
      clearStoredSession();
      return false;
    }
    const data = await res.json();
    return data.autenticado === true;
  } catch {
    /* Sin API: confiar en sesión local si no expiró */
    return true;
  }
}

export async function logoutAdminSession(): Promise<void> {
  const session = getStoredSession();
  if (session) {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', headers: authHeaders(session) });
    } catch { /* ignore */ }
  }
  clearStoredSession();
}

export function hasValidLocalSession(): boolean {
  return getStoredSession() !== null;
}
