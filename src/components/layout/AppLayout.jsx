import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, Upload, Shield, Waves } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts', label: 'Receipts', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/tax-reports', label: 'VAT Reports', icon: Shield, restricted: true },
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

      {/* ── Desktop Sidebar ──────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-64 fixed h-full z-30 masi-pattern"
        style={{ background: 'hsl(var(--fiji-deep))' }}
      >
        {/* Brand */}
        <div className="px-6 pt-7 pb-5 wave-pattern">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Waves className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-poppins font-bold text-lg tracking-wide leading-none">BULA AUDIT</span>
          </div>
          <p className="text-white/50 text-[10px] font-medium uppercase tracking-widest ml-10">Business Intelligence</p>
          {company && (
            <div className="mt-3 ml-10 px-2 py-1 rounded-md bg-white/10 border border-white/10">
              <p className="text-white/80 text-[11px] truncate font-medium">{company.name}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {filteredNav.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm border border-white/10'
                    : 'text-white/60 hover:bg-white/8 hover:text-white/90'
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/50'}`} />
                {item.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
              </Link>
            );
          })}

          {canUpload && (
            <Link
              to="/upload"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mt-3 text-white"
              style={{ background: 'hsl(var(--accent))' }}
            >
              <Upload className="w-4 h-4 shrink-0" />
              Upload Receipt
            </Link>
          )}
        </nav>

        <div className="px-3 pb-6 border-t border-white/10 pt-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white/80 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ─────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 wave-pattern masi-pattern"
        style={{ background: 'hsl(var(--fiji-deep))' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <Waves className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-poppins font-bold text-base tracking-wide">BULA AUDIT</span>
        </div>
        {company && (
          <span className="text-white/60 text-[11px] truncate max-w-[140px]">{company.name}</span>
        )}
      </div>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          background: 'hsl(var(--fiji-deep))',
          borderColor: 'rgba(255,255,255,0.1)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        <div
          className="flex items-stretch overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          {filteredNav.slice(0, 2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex flex-col items-center justify-center flex-shrink-0 px-3 py-2 min-h-[54px] min-w-[56px] transition-all ${
                  isActive ? 'text-white' : 'text-white/50'
                }`}
              >
                {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-accent" />}
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-1">{item.label}</span>
              </Link>
            );
          })}

          {canUpload && (
            <Link to="/upload"
              className="flex flex-col items-center justify-center flex-shrink-0 px-3 py-2 min-h-[54px] min-w-[56px] transition-all"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'hsl(var(--accent))' }}
              >
                <Upload className="w-4 h-4 text-white" />
              </div>
              <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-1 text-white/70">Upload</span>
            </Link>
          )}

          {filteredNav.slice(2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex flex-col items-center justify-center flex-shrink-0 px-3 py-2 min-h-[54px] min-w-[56px] transition-all ${
                  isActive ? 'text-white' : 'text-white/50'
                }`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-1">{item.label}</span>
              </Link>
            );
          })}

          <button onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-shrink-0 px-3 py-2 min-h-[54px] min-w-[56px] text-white/40"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[9px] font-medium whitespace-nowrap leading-tight mt-1">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main
        className="flex-1 md:ml-64 pt-14 md:pt-0 md:pb-0"
        style={{ paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 16px))' }}
      >
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}