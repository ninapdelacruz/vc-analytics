import { useStore } from '../store';
import { getStoredSession } from './adminAccess';
import type { ConfiguracionAcademica, SeedData } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'offline';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let pendingPush = false;
let hydrating = false;
let lastError: string | null = null;
let listeners = new Set<(s: SyncStatus, err: string | null) => void>();
let currentStatus: SyncStatus = 'idle';
/** Timestamp del último estado aplicado desde el servidor (ISO o Date string). */
let lastServerUpdatedAt: string | null = null;

function notify(status: SyncStatus, err: string | null = null) {
  currentStatus = status;
  lastError = err;
  listeners.forEach(fn => fn(status, err));
}

export function getSyncStatus() {
  return { status: currentStatus, error: lastError, lastServerUpdatedAt };
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

function applyServerEstado(e: {
  calificaciones?: SeedData['calificaciones'];
  alertas?: SeedData['alertas'];
  archivosCargados?: SeedData['archivosCargados'];
  intervenciones?: SeedData['intervenciones'];
  periodoActivo?: SeedData['periodoActivo'];
  actualizadoEn?: string;
}) {
  useStore.setState({
    calificaciones: e.calificaciones ?? [],
    alertas: e.alertas ?? [],
    archivosCargados: e.archivosCargados ?? [],
    intervenciones: e.intervenciones ?? [],
    periodoActivo: e.periodoActivo ?? 'P1',
  });
  if (e.actualizadoEn) {
    lastServerUpdatedAt = String(e.actualizadoEn);
  }
}

/**
 * Carga siempre desde el servidor (fuente de verdad).
 * Sobrescribe la caché local del navegador.
 */
export async function hydrateFromServer(options?: {
  silent?: boolean;
  onlyIfNewer?: boolean;
}): Promise<{ fromServer: boolean; registros: number; updated: boolean }> {
  const silent = options?.silent ?? false;
  const onlyIfNewer = options?.onlyIfNewer ?? false;

  if (hydrating || syncing) {
    return { fromServer: false, registros: 0, updated: false };
  }

  hydrating = true;
  if (!silent) notify('loading');

  try {
    const [estadoRes, configRes] = await Promise.all([
      fetch('/api/data/estado', { cache: 'no-store' }),
      fetch('/api/data/config', { cache: 'no-store' }),
    ]);

    if (!estadoRes.ok && estadoRes.status === 503) {
      if (!silent) notify('offline', 'Servidor de datos no disponible');
      return { fromServer: false, registros: 0, updated: false };
    }

    const estadoData = await estadoRes.json();
    const configData = await configRes.json();

    if (configData.ok && configData.configuracion) {
      useStore.setState({ configuracion: configData.configuracion as ConfiguracionAcademica });
    }

    if (estadoData.ok && !estadoData.empty && estadoData.estado) {
      const e = estadoData.estado;
      const serverTs = e.actualizadoEn ? String(e.actualizadoEn) : null;

      if (onlyIfNewer && serverTs && lastServerUpdatedAt && serverTs === lastServerUpdatedAt) {
        if (!silent) notify('synced');
        return {
          fromServer: true,
          registros: (e.calificaciones ?? []).length,
          updated: false,
        };
      }

      applyServerEstado(e);
      if (!silent) notify('synced');
      return {
        fromServer: true,
        registros: (e.calificaciones ?? []).length,
        updated: true,
      };
    }

    /* Servidor vacío: limpiar vista para no mostrar datos viejos de IndexedDB */
    useStore.setState({
      calificaciones: [],
      alertas: [],
      archivosCargados: [],
      intervenciones: [],
      periodoActivo: 'P1',
    });
    lastServerUpdatedAt = null;
    if (!silent) notify('idle');
    return { fromServer: true, registros: 0, updated: true };
  } catch (err) {
    if (!silent) {
      notify('offline', err instanceof Error ? err.message : 'Sin conexión al servidor');
    }
    return { fromServer: false, registros: 0, updated: false };
  } finally {
    hydrating = false;
  }
}

/** @deprecated No usar sync automático global. */
export function startStoreSync() {
  /* no-op */
}

/**
 * Guarda el estado actual en MySQL (solo desde Admin/Config).
 * Tras guardar, actualiza lastServerUpdatedAt para no pisar con datos viejos.
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

  if (ok) {
    /* Alinear timestamp del servidor para que otros dispositivos detecten la versión nueva */
    await hydrateFromServer({ silent: true, onlyIfNewer: false });
    notify('synced');
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
