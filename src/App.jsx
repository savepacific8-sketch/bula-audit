import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { CompanyProvider, useCompany } from '@/lib/useCompanyContext.jsx';

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
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <CompanyProvider>
      <AppContent />
    </CompanyProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App