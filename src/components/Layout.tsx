import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Bell, HelpCircle, Menu } from 'lucide-react';
import { useStore } from '../store';
import { obtenerPeriodosVisibles } from '../utils/calculations';
import { cn } from './Sidebar'; // we can just import cn from Sidebar or define it, actually we'll just import it

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  title: string;
  adminUnlocked?: boolean;
  onAdminLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children, activeTab, setActiveTab, title, adminUnlocked, onAdminLogout,
}) => {
  const { periodoActivo, setPeriodoActivo, archivosCargados, calificaciones, configuracion } = useStore();

  const periodos = obtenerPeriodosVisibles(calificaciones, configuracion);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsSidebarOpen(false);
      }
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
        adminUnlocked={adminUnlocked}
        onAdminLogout={onAdminLogout}
      />
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 xl:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className={cn(
        "flex-1 flex flex-col bg-white overflow-hidden h-screen transition-all duration-300 ease-in-out",
        isSidebarOpen ? "xl:ml-64" : "ml-0"
      )}>
        <header className="h-16 border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:block">{title}</h2>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            {archivosCargados.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período activo:</span>
                <div className="flex gap-1">
                  {periodos.map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriodoActivo(p as any)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                        periodoActivo === p 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1 md:gap-3 border-l border-slate-200 pl-3 md:pl-6">
              <button className="p-2 text-slate-500 hover:text-slate-700 relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <button className="p-2 text-slate-500 hover:text-slate-700">
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
