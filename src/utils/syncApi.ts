import { useStore } from '../store';
import { getStoredSession } from './adminAccess';
import type { ConfiguracionAcademica } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'offline';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let hydrating = false;
let lastError: string | null = null;
let listeners = new Set<(s: SyncStatus, err: string | null) => void>();
let currentStatus: SyncStatus = 'idle';
let subscribed = false;

function notify(status: SyncStatus, err: string | null = null) {
  currentStatus = status;
  lastError = err;
  listeners.forEach(fn => fn(status, err));
}

export function getSyncStatus() {
  return { status: currentStatus, error: lastError };
}

export function subscribeSyncStatus(fn: (s: SyncStatus, err: string | null) => void) {
  listeners.add(fn);
  fn(currentStatus, lastError);
  return () => { listeners.delete(fn); };
}

function authHeaders(): HeadersInit {
  const session = getStoredSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}

/** Escucha cambios del store y los guarda en MySQL si hay sesión admin. */
export function startStoreSync() {
  if (subscribed) return;
  subscribed = true;
  useStore.subscribe((state, prev) => {
    if (hydrating) return;
    if (!getStoredSession()) return;

    const dataChanged =
      state.calificaciones !== prev.calificaciones ||
      state.alertas !== prev.alertas ||
      state.archivosCargados !== prev.archivosCargados ||
      state.intervenciones !== prev.intervenciones ||
      state.periodoActivo !== prev.periodoActivo;

    const configChanged = state.configuracion !== prev.configuracion;

    if (configChanged) schedulePushConfig();
    else if (dataChanged) schedulePushToServer();
  });
}

/** Carga estado y configuración desde MySQL (cualquier dispositivo). */
export async function hydrateFromServer(): Promise<{ fromServer: boolean; registros: number }> {
  hydrating = true;
  notify('loading');
  try {
    const [estadoRes, configRes] = await Promise.all([
      fetch('/api/data/estado'),
      fetch('/api/data/config'),
    ]);

    if (!estadoRes.ok && estadoRes.status === 503) {
      notify('offline', 'MySQL no disponible');
      return { fromServer: false, registros: 0 };
    }

    const estadoData = await estadoRes.json();
    const configData = await configRes.json();

    if (configData.ok && configData.configuracion) {
      useStore.setState({ configuracion: configData.configuracion as ConfiguracionAcademica });
    }

    if (estadoData.ok && !estadoData.empty && estadoData.estado) {
      const e = estadoData.estado;
      useStore.setState({
        calificaciones: e.calificaciones ?? [],
        alertas: e.alertas ?? [],
        archivosCargados: e.archivosCargados ?? [],
        intervenciones: e.intervenciones ?? [],
        periodoActivo: e.periodoActivo ?? 'P1',
      });
      notify('synced');
      return { fromServer: true, registros: (e.calificaciones ?? []).length };
    }

    /* Servidor vacío: si hay datos locales y sesión admin, subirlos */
    const local = useStore.getState();
    if (local.calificaciones.length > 0 && getStoredSession()) {
      const pushed = await pushStateToServer();
      notify(pushed ? 'synced' : 'error', pushed ? null : lastError);
      return { fromServer: false, registros: local.calificaciones.length };
    }

    notify('idle');
    return { fromServer: false, registros: 0 };
  } catch (err) {
    notify('offline', err instanceof Error ? err.message : 'Sin conexión al servidor');
    return { fromServer: false, registros: 0 };
  } finally {
    hydrating = false;
  }
}

/** Guarda el estado actual en MySQL (requiere sesión admin). */
export async function pushStateToServer(): Promise<boolean> {
  if (syncing) return false;
  const session = getStoredSession();
  if (!session) {
    lastError = 'Ingrese a Administración para sincronizar con MySQL.';
    notify('error', lastError);
    return false;
  }

  syncing = true;
  notify('saving');
  try {
    const state = useStore.getState();
    const res = await fetch('/api/data/estado', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        calificaciones: state.calificaciones,
        alertas: state.alertas,
        archivosCargados: state.archivosCargados,
        intervenciones: state.intervenciones,
        periodoActivo: state.periodoActivo,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      lastError = typeof data.error === 'string' ? data.error : 'No se pudo guardar en MySQL';
      notify('error', lastError);
      return false;
    }
    notify('synced');
    return true;
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Error de red al guardar';
    notify('error', lastError);
    return false;
  } finally {
    syncing = false;
  }
}

export async function pushConfigToServer(): Promise<boolean> {
  const session = getStoredSession();
  if (!session) return false;
  try {
    const res = await fetch('/api/data/config', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ configuracion: useStore.getState().configuracion }),
    });
    const data = await res.json();
    return res.ok && data.ok;
  } catch {
    return false;
  }
}

/** Guarda en MySQL con debounce (tras cargar/borrar archivos, etc.). */
export function schedulePushToServer(delayMs = 600) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void pushStateToServer();
  }, delayMs);
}

/** Tras cambios de configuración académica. */
export function schedulePushConfig(delayMs = 600) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void pushConfigToServer();
    void pushStateToServer();
  }, delayMs);
}
