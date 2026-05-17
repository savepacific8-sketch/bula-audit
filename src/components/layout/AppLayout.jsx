import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, Upload, Shield, Waves } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';

const navItems = [
  { path: '/',            label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts',    label: 'Receipts',  icon: Receipt },
  { path: '/reports',     label: 'Reports',   icon: FileText },
  { path: '/tax-reports', label: 'VAT',       icon: Shield, restricted: true },
  { path: '/team',        label: 'Team',      icon: Users },
  { path: '/company',     label: 'Company',   icon: Building2 },
];

export default function AppLayout() {
  const location = useLocation();
  const { company, userRole, canUpload } = useCompany();

  const filteredNav = navItems.filter(item => {
    if (item.path === '/team' && userRole !== 'owner' && userRole !== 'manager') return false;
    if (item.restricted && userRole !== 'owner' && userRole !== 'manager' && userRole !== 'accountant') return false;
    return true;
  });

  const handleLogout = () => base44.auth.logout('/');

  return (
    <div className="bg-background flex" style={{ minHeight: '100dvh' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-64 fixed h-full z-30 masi-pattern"
        style={{ background: 'hsl(var(--fiji-deep))' }}
      >
        {/* Brand */}
        <div className="px-6 pt-7 pb-5 wave-pattern">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Waves className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-poppins font-bold text-lg tracking-wide leading-none">BULA AUDIT</span>
          </div>
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest ml-10">Business Intelligence</p>
          {company && (
            <div className="mt-3 ml-10 px-2 py-1.5 rounded-lg bg-white/10 border border-white/10">
              <p className="text-white/75 text-[11px] truncate font-medium">{company.name}</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filteredNav.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/10 shadow-sm'
                    : 'text-white/55 hover:bg-white/8 hover:text-white/85'
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/45'}`} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'hsl(var(--accent))' }} />
                )}
              </Link>
            );
          })}

          {canUpload && (
            <Link
              to="/upload"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-4 shadow-md"
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/45 hover:bg-white/8 hover:text-white/80 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Header ──────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 masi-pattern wave-pattern"
        style={{
          background: 'hsl(var(--fiji-deep))',
          paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
          paddingBottom: '10px',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <Waves className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-poppins font-bold text-base tracking-wide">BULA AUDIT</span>
        </div>
        {company && (
          <span className="text-white/55 text-[11px] truncate max-w-[140px] font-medium">{company.name}</span>
        )}
      </div>

      {/* ── Mobile Bottom Nav ──────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          background: 'hsl(var(--fiji-deep))',
          borderColor: 'rgba(255,255,255,0.10)',
          paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        }}
      >
        <div
          className="flex items-stretch"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', overflowX: 'auto' }}
        >
          {/* First 2 nav items */}
          {filteredNav.slice(0, 2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center flex-1 min-w-[52px] py-2 relative transition-colors"
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: 'hsl(var(--accent))' }}
                  />
                )}
                <item.icon
                  className={`w-[20px] h-[20px] shrink-0 ${isActive ? 'text-white' : 'text-white/45'}`}
                />
                <span className={`text-[10px] font-medium mt-1 whitespace-nowrap ${isActive ? 'text-white' : 'text-white/45'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Upload FAB (centre) */}
          {canUpload && (
            <Link
              to="/upload"
              className="flex flex-col items-center justify-center flex-1 min-w-[52px] py-2"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'hsl(var(--accent))' }}
              >
                <Upload className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <span className="text-[10px] font-medium mt-1 whitespace-nowrap text-white/55">Upload</span>
            </Link>
          )}

          {/* Remaining nav items */}
          {filteredNav.slice(2).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center flex-1 min-w-[52px] py-2 relative transition-colors"
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: 'hsl(var(--accent))' }}
                  />
                )}
                <item.icon
                  className={`w-[20px] h-[20px] shrink-0 ${isActive ? 'text-white' : 'text-white/45'}`}
                />
                <span className={`text-[10px] font-medium mt-1 whitespace-nowrap ${isActive ? 'text-white' : 'text-white/45'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 min-w-[52px] py-2 text-white/35 transition-colors"
          >
            <LogOut className="w-[20px] h-[20px] shrink-0" />
            <span className="text-[10px] font-medium mt-1 whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main
        className="flex-1 md:ml-64"
        style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 12px))',
        }}
      >
        <div className="p-4 md:p-8 md:pt-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}