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
        {company && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{company.name}</p>}
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 flex items-center justify-around px-1 py-2 safe-area-pb">
        {filteredNav.slice(0, 2).map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Upload FAB */}
        {canUpload && (
          <Link to="/upload"
            className={`flex flex-col items-center gap-0.5 -mt-5 transition-all ${location.pathname === '/upload' ? 'text-primary' : 'text-primary'}`}
          >
            <div className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center">
              <PlusCircle className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium text-primary mt-0.5">Upload</span>
          </Link>
        )}

        {filteredNav.slice(2).map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        <button onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}