import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts', label: 'Receipts', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/team', label: 'Team', icon: Users },
  { path: '/company', label: 'Company', icon: Building2 },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { company, userRole } = useCompany();

  const filteredNav = navItems.filter(item => {
    if (item.path === '/team' && userRole !== 'owner' && userRole !== 'manager') return false;
    return true;
  });

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card fixed h-full z-30">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary tracking-tight">BULA AUDIT</h1>
          {company && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{company.name}</p>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {filteredNav.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-40 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary tracking-tight">BULA AUDIT</h1>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-card border-b border-border shadow-lg" onClick={e => e.stopPropagation()}>
            <nav className="p-3 space-y-1">
              {filteredNav.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary w-full"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}