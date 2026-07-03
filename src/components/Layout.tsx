import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Bell, HelpCircle, Menu, CalendarDays, Cloud, CloudOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import { obtenerPeriodosVisibles } from '../utils/calculations';
import { cn } from './Sidebar';
import type { SyncStatus } from '../utils/syncApi';
import { ESCUDO_URL } from '../constants/branding';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  title: string;
  syncStatus?: SyncStatus;
  syncError?: string | null;
}

export const Layout: React.FC<LayoutProps> = ({
  children, activeTab, setActiveTab, title, syncStatus = 'idle', syncError = null,
}) => {
  const { periodoActivo, setPeriodoActivo, archivosCargados, calificaciones, configuracion } = useStore();
  const periodos = obtenerPeriodosVisibles(calificaciones, configuracion);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) setIsSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-20 xl:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={cn(
        'flex-1 flex flex-col bg-white overflow-hidden h-screen transition-all duration-300 ease-in-out',
        isSidebarOpen ? 'xl:ml-64' : 'ml-0'
      )}>
        <header className="min-h-16 border-b border-slate-200 px-3 md:px-6 py-2 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img
              src={ESCUDO_URL}
              alt="Escudo IE Villa Campo"
              className="w-9 h-9 object-contain shrink-0 hidden sm:block"
            />
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-[#0D47A1] uppercase tracking-widest truncate">{title}</h2>
              <p className="text-[10px] text-slate-400 truncate hidden md:block">Institución Educativa Villa Campo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {archivosCargados.length > 0 && (
              <div className="flex items-center gap-2 md:gap-3 bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-[#0D47A1]/30 rounded-xl px-2.5 py-1.5 md:px-4 md:py-2 shadow-sm">
                <div className="hidden sm:flex items-center gap-1.5 text-[#0D47A1]">
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                    Período activo
                  </span>
                </div>
                <div className="flex gap-1">
                  {periodos.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriodoActivo(p as 'P1' | 'P2' | 'P3' | 'P4' | 'DEF')}
                      className={cn(
                        'min-w-[2.25rem] px-2.5 py-1.5 rounded-lg text-xs font-black uppercase transition-all border-2',
                        periodoActivo === p
                          ? 'bg-[#008f39] text-white border-[#008f39] shadow-md scale-105'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border border-slate-200 bg-slate-50"
              title={syncError ?? 'Estado de sincronización'}
            >
              {syncStatus === 'loading' || syncStatus === 'saving' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /><span className="text-blue-700">{syncStatus === 'saving' ? 'Guardando' : 'Cargando'}</span></>
              ) : syncStatus === 'synced' ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-700">Sincronizado</span></>
              ) : syncStatus === 'offline' || syncStatus === 'error' ? (
                <><CloudOff className="w-3.5 h-3.5 text-amber-600" /><span className="text-amber-700">Local</span></>
              ) : (
                <><Cloud className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-500">Sincronizado</span></>
              )}
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 md:pl-4">
              <button type="button" className="p-2 text-slate-500 hover:text-slate-700 relative" aria-label="Notificaciones">
                <Bell className="w-4 h-4" />
              </button>
              <button type="button" className="p-2 text-slate-500 hover:text-slate-700" aria-label="Ayuda">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 bg-slate-50/50 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
