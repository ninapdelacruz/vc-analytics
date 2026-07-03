import React, { useState, useCallback } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import { PROTECTED_MODULE_LABELS, ProtectedModule } from '../constants/protectedModules';
import { verifyAccessCode } from '../utils/adminAccess';

interface AccessGateProps {
  modulo: ProtectedModule;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({ modulo, onSuccess, onCancel }) => {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyAccessCode(codigo, modulo);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  }, [codigo, modulo, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
        role="dialog"
        aria-labelledby="access-gate-title"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="access-gate-title" className="text-sm font-bold text-slate-800">
                Acceso restringido
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {PROTECTED_MODULE_LABELS[modulo]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            aria-label="Cancelar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Este módulo requiere el código institucional. No hay usuarios ni roles: un mismo código
            habilita Administración, Configuración y Calidad de datos.
          </p>
          <div>
            <label htmlFor="access-code" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Código de acceso
            </label>
            <input
              id="access-code"
              type="password"
              autoComplete="off"
              autoFocus
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Ingrese el código..."
              className="mt-1.5 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 font-medium" role="alert">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-xs font-bold uppercase text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !codigo.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase text-white bg-[#0D47A1] rounded-lg hover:bg-blue-900 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
