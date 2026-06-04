import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { useSystemDarkMode } from '@/hooks/useSystemDarkMode';
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CompanyProvider, useCompany } from '@/lib/useCompanyContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Receipts from '@/pages/Receipts';
import Reports from '@/pages/Reports';
import Team from '@/pages/Team';
import CompanyProfile from '@/pages/CompanyProfile';
import Onboarding from '@/pages/Onboarding';
import UploadReceipt from '@/pages/UploadReceipt';
import ReceiptReview from '@/pages/ReceiptReview';
import ReceiptScannerAgent from '@/pages/ReceiptScannerAgent';
import TaxReports from '@/pages/TaxReports';
import Billing from '@/pages/Billing';
import AdminBilling from '@/pages/AdminBilling';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';
import { Privacy, Terms } from '@/pages/Legal';
import Settings from '@/pages/Settings';
import AuditLog from '@/pages/AuditLog';

const AppContent = () => {
  const { company, loading, refreshContext } = useCompany();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading BULA AUDIT...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return <Onboarding onComplete={refreshContext} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/team" element={<Team />} />
        <Route path="/company" element={<CompanyProfile />} />
        <Route path="/upload" element={<UploadReceipt />} />
        <Route path="/receipt-review" element={<ReceiptReview />} />
        <Route path="/receipt-scanner" element={<ReceiptScannerAgent />} />
        <Route path="/tax-reports" element={<TaxReports />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/admin-billing" element={<AdminBilling />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-log" element={<AuditLog />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};



const RoutedApp = () => {
  useSystemDarkMode();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/register" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route
          path="/*"
          element={
            <CompanyProvider>
              <AppContent />
            </CompanyProvider>
          }
        />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <RoutedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App