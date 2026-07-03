/** Módulos que requieren código de acceso institucional (sin usuarios/roles). */
export const PROTECTED_MODULES = ['admin', 'config', 'calidad'] as const;
export type ProtectedModule = (typeof PROTECTED_MODULES)[number];

export function isProtectedModule(tab: string): tab is ProtectedModule {
  return (PROTECTED_MODULES as readonly string[]).includes(tab);
}

export const PROTECTED_MODULE_LABELS: Record<ProtectedModule, string> = {
  admin: 'Administración',
  config: 'Configuración académica',
  calidad: 'Calidad de datos',
};
