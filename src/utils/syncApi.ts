import { useStore } from '../store';
import { getStoredSession } from './adminAccess';
import type { ConfiguracionAcademica } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'offline' | 'pending';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let pendingPush = false;
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

function stateRichness(s: {
  archivosCargados?: unknown[];
  calificaciones?: unknown[];
}) {
  return {
    archivos: s.archivosCargados?.length ?? 0,
    califs: s.calificaciones?.length ?? 0,
  };
}

function isRicher(
  a: { archivos: number; califs: number },
  b: { archivos: number; califs: number }
) {
  return a.archivos > b.archivos || (a.archivos === b.archivos && a.califs > b.califs);
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
    else if (dataChanged) schedulePushToServer(300);
  });
}

/** Carga estado desde MySQL. Si este dispositivo tiene MÁS datos, los conserva y sube al servidor. */
export async function hydrateFromServer(): Promise<{ fromServer: boolean; registros: number }> {
  hydrating = true;
  notify('loading');
  try {
    const [estadoRes, configRes] = await Promise.all([
      fetch('/api/data/estado'),
      fetch('/api/data/config'),
    ]);

    if (!estadoRes.ok && estadoRes.status === 503) {
      notify('offline', 'Servidor de datos no disponible');
      return { fromServer: false, registros: 0 };
    }

    const estadoData = await estadoRes.json();
    const configData = await configRes.json();

    if (configData.ok && configData.configuracion) {
      useStore.setState({ configuracion: configData.configuracion as ConfiguracionAcademica });
    }

    const local = useStore.getState();
    const localR = stateRichness(local);

    if (estadoData.ok && !estadoData.empty && estadoData.estado) {
      const e = estadoData.estado;
      const serverR = stateRichness(e);

      /* Este navegador tiene más archivos/notas que el servidor → subir, no pisar */
      if (localR.archivos > 0 && isRicher(localR, serverR)) {
        hydrating = false;
        if (getStoredSession()) {
          const pushed = await pushStateToServer();
          if (pushed) {
            notify('synced');
            return { fromServer: false, registros: localR.califs };
          }
        }
        notify(
          'pending',
          `Este dispositivo tiene ${localR.archivos} archivos y el servidor ${serverR.archivos}. Entre a Administración para sincronizar.`
        );
        return { fromServer: false, registros: localR.califs };
      }

      useStore.setState({
        calificaciones: e.calificaciones ?? [],
        alertas: e.alertas ?? [],
        archivosCargados: e.archivosCargados ?? [],
        intervenciones: e.intervenciones ?? [],
        periodoActivo: e.periodoActivo ?? 'P1',
      });
      notify('synced');
      return { fromServer: true, registros: serverR.califs };
    }

    /* Servidor vacío: subir locales si hay sesión */
    if (localR.califs > 0 && getStoredSession()) {
      hydrating = false;
      const pushed = await pushStateToServer();
      notify(pushed ? 'synced' : 'error', pushed ? null : lastError);
      return { fromServer: false, registros: localR.califs };
    }

    if (localR.califs > 0) {
      notify(
        'pending',
        `Hay ${localR.archivos} archivos solo en este dispositivo. Entre a Administración para subirlos al servidor.`
      );
      return { fromServer: false, registros: localR.califs };
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

/**
 * Guarda el estado actual en MySQL (requiere sesión admin).
 * Si ya hay un guardado en curso, encola otro al terminar (no pierde cargas múltiples).
 */
export async function pushStateToServer(): Promise<boolean> {
  if (syncing) {
    pendingPush = true;
    return false;
  }

  const session = getStoredSession();
  if (!session) {
    lastError = 'Ingrese a Administración para sincronizar.';
    notify('error', lastError);
    return false;
  }

  syncing = true;
  notify('saving');
  let ok = false;

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

    let data: { ok?: boolean; error?: string } = {};
    try {
      data = await res.json();
    } catch {
      lastError = `Error del servidor (${res.status})`;
      notify('error', lastError);
      ok = false;
      data = {};
    }

    if (res.ok && data.ok) {
      ok = true;
      notify('synced');
    } else {
      lastError = typeof data.error === 'string' ? data.error : 'No se pudo guardar en el servidor';
      notify('error', lastError);
      ok = false;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Error de red al guardar';
    notify('error', lastError);
    ok = false;
  } finally {
    syncing = false;
  }

  if (pendingPush) {
    pendingPush = false;
    const again = await pushStateToServer();
    return again || ok;
  }
  return ok;
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

/** Guarda en el servidor con debounce (cargas múltiples en lote). */
export function schedulePushToServer(delayMs = 400) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void pushStateToServer();
  }, delayMs);
}

export function schedulePushConfig(delayMs = 400) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void pushConfigToServer();
    void pushStateToServer();
  }, delayMs);
}
