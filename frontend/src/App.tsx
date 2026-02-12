import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import AppShell from '@/components/layout/AppShell';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import RequestListPage from '@/pages/RequestListPage';
import RequestCreatePage from '@/pages/RequestCreatePage';
import RequestDetailPage from '@/pages/RequestDetailPage';
import ApprovalQueuePage from '@/pages/ApprovalQueuePage';
import FundingPage from '@/pages/FundingPage';
import LifecycleCalendarPage from '@/pages/LifecycleCalendarPage';
import DataWizardPage from '@/pages/DataWizardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<RequestListPage />} />
        <Route path="requests/new" element={<RequestCreatePage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="requests/:id/edit" element={<RequestCreatePage />} />
        <Route path="approvals" element={<ApprovalQueuePage />} />
        <Route path="funding" element={<FundingPage />} />
        <Route path="lifecycle" element={<LifecycleCalendarPage />} />
        <Route path="data-wizard" element={<DataWizardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
