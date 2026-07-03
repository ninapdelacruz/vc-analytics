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

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('El servidor no respondió. Revise que la app Node esté en ejecución.');
  }
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    throw new Error(
      'La API no está activa: el servidor devolvió HTML en lugar de JSON. ' +
      'En hPanel use Entry file = server.js y Output directory = dist, luego reinicie la app. ' +
      'Pruebe /api/health en el navegador.'
    );
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error('Respuesta inválida del servidor. Pruebe /api/health.');
  }
}

export async function verifyAccessCode(codigo: string, modulo: string): Promise<AdminSession> {
  let res: Response;
  try {
    res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, modulo }),
    });
  } catch {
    throw new Error('No se pudo contactar la API. Verifique que el servidor Node esté activo.');
  }

  const data = await readJsonResponse(res);
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Código incorrecto');
  }

  const session: AdminSession = {
    token: String(data.token),
    expiresAt: String(data.expiresAt),
  };
  setStoredSession(session);
  return session;
}

export async function validateStoredSession(): Promise<boolean> {
  const session = getStoredSession();
  if (!session) return false;
  try {
    const res = await fetch('/api/auth/session', { headers: authHeaders(session) });
    const text = await res.text();
    if (text.trim().startsWith('<')) {
      clearStoredSession();
      return false;
    }
    if (!res.ok) {
      clearStoredSession();
      return false;
    }
    const data = JSON.parse(text) as { autenticado?: boolean };
    return data.autenticado === true;
  } catch {
    clearStoredSession();
    return false;
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
