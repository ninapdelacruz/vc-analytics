import React from 'react';
import { Home, BarChart2, TrendingDown, Target, Users, BookOpen, Bookmark, ClipboardList, FileWarning, Settings, X, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isProtectedModule } from '../constants/protectedModules';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, isOpen, setIsOpen,
}) => {
  const menuItems = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'resumen', label: 'Resumen institucional', icon: BarChart2 },
    { id: 'riesgo', label: 'Riesgo de pérdida', icon: TrendingDown },
    { id: 'recuperacion', label: 'Nota necesaria', icon: Target },
    { id: 'estudiantes', label: 'Estudiantes', icon: Users },
    { id: 'cursos', label: 'Cursos', icon: BookOpen },
    { id: 'asignaturas', label: 'Asignaturas', icon: Bookmark },
    { id: 'calidad', label: 'Calidad de datos', icon: FileWarning },
    { id: 'admin', label: 'Administración', icon: Settings },
    { id: 'config', label: 'Configuración', icon: ClipboardList },
  ];

  const handleNav = (id: string) => {
    setActiveTab(id);
    setIsOpen(false);
  };

  return (
    <aside
      className={cn(
        'w-64 bg-[#0D47A1] text-white flex flex-col fixed left-0 top-0 h-screen border-r border-blue-900 z-30',
        'transition-transform duration-200 ease-out shadow-xl',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
      aria-label="Menú principal"
    >
      <div className="p-5 flex items-center justify-between gap-3 border-b border-blue-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/escudo-villa-campo.png"
            alt="Escudo IE Villa Campo"
            className="w-11 h-11 object-contain rounded-full bg-white p-0.5 shadow-md shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xs font-bold leading-tight uppercase tracking-widest truncate">VILLA CAMPO</h1>
            <p className="text-[10px] opacity-80 truncate">Análisis académico</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="xl:hidden p-1.5 text-blue-200 hover:text-white rounded-md hover:bg-blue-800 transition-colors"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-widest text-blue-300/90 font-bold px-3 mb-2">
          Módulos principales
        </div>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const locked = isProtectedModule(item.id);
          return (
            <button
              key={item.id}
              type="button"
              title={locked ? `${item.label} (requiere código)` : item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleNav(item.id)}
              className={cn(
                'group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left',
                'transition-all duration-150 border-l-4',
                isActive
                  ? 'bg-blue-950/60 border-green-400 font-semibold text-white shadow-sm'
                  : 'border-transparent text-blue-50 hover:bg-blue-700/90 hover:border-green-300 hover:text-white hover:shadow-md active:scale-[0.98]'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  isActive ? 'text-green-400' : 'text-blue-200 group-hover:text-green-300'
                )}
              />
              <span className="truncate flex-1">{item.label}</span>
              {locked && <Lock className="w-3.5 h-3.5 shrink-0 text-blue-300" aria-hidden />}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-blue-900 bg-blue-950/80">
        <p className="px-3 py-2 text-[10px] text-blue-300/80 leading-relaxed">
          Admin, Config y Calidad requieren código institucional en cada ingreso.
        </p>
      </div>
    </aside>
  );
};
