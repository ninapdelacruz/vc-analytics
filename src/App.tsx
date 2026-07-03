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
import { hasValidLocalSession, validateStoredSession, logoutAdminSession } from './utils/adminAccess';

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
  const [adminUnlocked, setAdminUnlocked] = useState(hasValidLocalSession);
  const [gateModulo, setGateModulo] = useState<ProtectedModule | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const { calificaciones } = useStore();

  useEffect(() => {
    validateStoredSession().then(valid => setAdminUnlocked(valid));
  }, []);

  const navigateTo = useCallback((tab: string) => {
    if (isProtectedModule(tab) && !adminUnlocked) {
      setPendingTab(tab);
      setGateModulo(tab);
      return;
    }
    setActiveTab(tab);
  }, [adminUnlocked]);

  const handleGateSuccess = useCallback(() => {
    setAdminUnlocked(true);
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

  const handleAdminLogout = useCallback(async () => {
    await logoutAdminSession();
    setAdminUnlocked(false);
    if (isProtectedModule(activeTab)) {
      setActiveTab('inicio');
    }
  }, [activeTab]);

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
    if (activeTab === 'admin') return withSuspense(<AdminDashboard onNavigate={navigateTo} />);
    if (activeTab === 'config') return withSuspense(<ConfigDashboard />);
    if (activeTab === 'calidad') return withSuspense(<DataQualityDashboard />);

    if (calificaciones.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-20 h-20 bg-blue-50 text-[#004aad] rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay datos cargados</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Para ver los análisis, primero debes cargar los archivos de calificaciones en Excel.
          </p>
          <button
            onClick={() => navigateTo('admin')}
            className="px-6 py-3 bg-[#004aad] text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
          >
            Ir a Administración
          </button>
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
      case 'calidad': return withSuspense(<DataQualityDashboard />);
      default: return <div className="p-8 text-center text-gray-500">Módulo en desarrollo: {activeTab}</div>;
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={navigateTo}
        title={getTitle()}
        adminUnlocked={adminUnlocked}
        onAdminLogout={handleAdminLogout}
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
