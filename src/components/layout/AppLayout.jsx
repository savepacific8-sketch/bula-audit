import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, PlusCircle, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts', label: 'Receipts', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/tax-reports', label: 'Tax Reports', icon: Shield, restricted: true },
  { path: '/team', label: 'Team', icon: Users },
  { path: '/company', label: 'Company', icon: Building2 },
];

export default function AppLayout() {
  const location = useLocation();
  const { company, userRole, canUpload } = useCompany();

  const filteredNav = navItems.filter(item => {
    if (item.path === '/team' && userRole !== 'owner' && userRole !== 'manager') return false;
    if (item.restricted && userRole !== 'owner' && userRole !== 'manager' && userRole !== 'accountant') return false;
    return true;
  });

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  return (
    <div className="bg-background flex" style={{ minHeight: '100dvh' }}>
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
        {company && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{company.name}</p>}
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 overflow-x-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="flex items-center justify-around min-w-max w-full px-0.5 py-0.5">
          {filteredNav.slice(0, 2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex flex-col items-center justify-center gap-0 px-2 min-h-[44px] min-w-[44px] rounded-lg transition-all ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}

          {/* Center Upload FAB */}
          {canUpload && (
            <Link to="/upload"
              className="flex flex-col items-center justify-center gap-0 px-2 min-h-[44px] min-w-[44px] transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary shadow-lg flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-primary-foreground" />
              </div>
            </Link>
          )}

          {filteredNav.slice(2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex flex-col items-center justify-center gap-0 px-2 min-h-[44px] min-w-[44px] rounded-lg transition-all ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}

          <button onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-0 px-2 min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-0.5">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main
        className="flex-1 md:ml-64 pt-14 md:pt-0 md:pb-0"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))' }}
      >
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}