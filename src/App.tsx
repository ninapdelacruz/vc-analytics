/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { AccessGate } from './components/AccessGate';
import { useStore } from './store';
import { isProtectedModule, ProtectedModule } from './constants/protectedModules';
import { logoutAdminSession } from './utils/adminAccess';
import {
  hydrateFromServer,
  subscribeSyncStatus,
  type SyncStatus,
} from './utils/syncApi';
import { ESCUDO_URL } from './constants/branding';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const HomeDashboard = lazy(() => import('./pages/HomeDashboard').then(m => ({ default: m.HomeDashboard })));
const SummaryDashboard = lazy(() => import('./pages/SummaryDashboard').then(m => ({ default: m.SummaryDashboard })));
const RiskDashboard = lazy(() => import('./pages/RiskDashboard').then(m => ({ default: m.RiskDashboard })));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const CourseDashboard = lazy(() => import('./pages/CourseDashboard').then(m => ({ default: m.CourseDashboard })));
const SubjectDashboard = lazy(() => import('./pages/SubjectDashboard').then(m => ({ default: m.SubjectDashboard })));
const DataQualityDashboard = lazy(() => import('./pages/DataQualityDashboard').then(m => ({ default: m.DataQualityDashboard })));
const ConfigDashboard = lazy(() => import('./pages/ConfigDashboard').then(m => ({ default: m.ConfigDashboard })));
const RecoveryDashboard = lazy(() => import('./pages/RecoveryDashboard').then(m => ({ default: m.RecoveryDashboard })));

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<DashboardSkeleton />}>{node}</Suspense>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [gateModulo, setGateModulo] = useState<ProtectedModule | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const { calificaciones } = useStore();

  useEffect(() => {
    /* Lectura desde servidor solo al abrir/recargar la página. Escritura solo Admin/Config. */
    const unsubStatus = subscribeSyncStatus((s, err) => {
      setSyncStatus(s);
      setSyncError(err);
    });

    const runHydrate = async () => {
      setBootstrapping(true);
      await hydrateFromServer();
      setBootstrapping(false);
    };

    const persistApi = useStore.persist;
    if (persistApi.hasHydrated()) {
      void runHydrate();
    } else {
      const unsub = persistApi.onFinishHydration(() => {
        void runHydrate();
      });
      return () => {
        unsub();
        unsubStatus();
      };
    }

    return () => unsubStatus();
  }, []);

  /** Navegación inmediata. Sync solo ocurre dentro de Admin/Config al guardar datos. */
  const navigateTo = useCallback((tab: string) => {
    if (isProtectedModule(tab)) {
      setPendingTab(tab);
      setGateModulo(tab);
      return;
    }
    if (isProtectedModule(activeTab)) {
      void logoutAdminSession();
    }
    setActiveTab(tab);
  }, [activeTab]);

  const handleGateSuccess = useCallback(() => {
    setGateModulo(null);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  }, [pendingTab]);

  const handleGateCancel = useCallback(() => {
    setGateModulo(null);
    setPendingTab(null);
  }, []);

  const getTitle = () => {
    switch (activeTab) {
      case 'inicio': return 'Panel Principal';
      case 'resumen': return 'Resumen Institucional';
      case 'riesgo': return 'Riesgo de Pérdida del Año';
      case 'recuperacion': return 'Nota Necesaria para Aprobar';
      case 'estudiantes': return 'Detalle Académico';
      case 'cursos': return 'Análisis por Curso';
      case 'asignaturas': return 'Análisis por Asignatura';
      case 'calidad': return 'Calidad de Datos';
      case 'admin': return 'Panel de Administración';
      case 'config': return 'Configuración Académica';
      default: return 'Villa Campo Analytics';
    }
  };

  const renderContent = () => {
    if (bootstrapping) {
      return <DashboardSkeleton />;
    }

    if (activeTab === 'admin') return withSuspense(<AdminDashboard onNavigate={navigateTo} />);
    if (activeTab === 'config') return withSuspense(<ConfigDashboard />);
    if (activeTab === 'calidad') return withSuspense(<DataQualityDashboard />);

    if (calificaciones.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <img
            src={ESCUDO_URL}
            alt="Escudo IE Villa Campo"
            className="w-20 h-20 object-contain mb-6"
          />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay datos cargados</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Los datos se guardan en MySQL y se comparten entre dispositivos.
            Entre a Administración, ingrese el código e importe los archivos Excel.
          </p>
          <button
            onClick={() => navigateTo('admin')}
            className="px-6 py-3 bg-[#004aad] text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
          >
            Ir a Administración
          </button>
          {syncError && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-md">
              {syncError}
            </p>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'inicio': return withSuspense(<HomeDashboard onNavigate={navigateTo} />);
      case 'resumen': return withSuspense(<SummaryDashboard />);
      case 'riesgo': return withSuspense(<RiskDashboard />);
      case 'recuperacion': return withSuspense(<RecoveryDashboard />);
      case 'estudiantes': return withSuspense(<StudentDashboard />);
      case 'cursos': return withSuspense(<CourseDashboard />);
      case 'asignaturas': return withSuspense(<SubjectDashboard />);
      default: return <div className="p-8 text-center text-gray-500">Módulo en desarrollo: {activeTab}</div>;
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={navigateTo}
        title={getTitle()}
        syncStatus={syncStatus}
        syncError={syncError}
      >
        {renderContent()}
      </Layout>
      {gateModulo && (
        <AccessGate
          modulo={gateModulo}
          onSuccess={handleGateSuccess}
          onCancel={handleGateCancel}
        />
      )}
    </>
  );
}
