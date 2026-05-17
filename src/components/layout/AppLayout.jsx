import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, Upload, Shield, Menu, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import BulaLogo from '@/components/layout/BulaLogo';

const navItems = [
  { path: '/',            label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts',    label: 'Receipts',  icon: Receipt },
  { path: '/reports',     label: 'Reports',   icon: FileText },
  { path: '/tax-reports', label: 'VAT',       icon: Shield, restricted: true },
  { path: '/team',        label: 'Team',      icon: Users },
  { path: '/company',     label: 'Company',   icon: Building2 },
];

function Sidebar({ filteredNav, company, canUpload, onNavigate }) {
  const location = useLocation();
  const handleLogout = () => base44.auth.logout('/');

  return (
    <div className="flex flex-col h-full masi-pattern" style={{ background: 'hsl(var(--fiji-deep))' }}>
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <BulaLogo size={36} />
          <div>
            <span className="text-white font-poppins font-bold text-[17px] tracking-wide leading-none block">BULA AUDIT</span>
            <p className="text-white/40 text-[9px] font-semibold uppercase tracking-widest mt-0.5">Fiji Business Finance</p>
          </div>
        </div>
        {company && (
          <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/10">
            <p className="text-white/70 text-[11px] truncate font-medium">{company.name}</p>
          </div>
        )}
      </div>

      <div className="mx-6 h-px bg-white/10" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredNav.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
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
            onClick={onNavigate}
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
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { company, userRole, canUpload } = useCompany();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter(item => {
    if (item.path === '/team' && userRole !== 'owner' && userRole !== 'manager') return false;
    if (item.restricted && userRole !== 'owner' && userRole !== 'manager' && userRole !== 'accountant') return false;
    return true;
  });

  return (
    <div className="bg-background flex" style={{ minHeight: '100svh' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 fixed h-full z-30">
        <Sidebar filteredNav={filteredNav} company={company} canUpload={canUpload} onNavigate={() => {}} />
      </aside>

      {/* ── Mobile: Sidebar Drawer ──────────────────────────────── */}
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className="md:hidden fixed top-0 left-0 h-full z-50 w-72 transition-transform duration-300"
        style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 z-10 text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <Sidebar filteredNav={filteredNav} company={company} canUpload={canUpload} onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* ── Mobile Top Header (hamburger) ──────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 masi-pattern wave-pattern"
        style={{
          background: 'hsl(var(--fiji-deep))',
          paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
          paddingBottom: '10px',
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white/80 hover:text-white p-1 -ml-1"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <BulaLogo size={24} />
          <span className="text-white font-poppins font-bold text-base tracking-wide">BULA AUDIT</span>
        </div>
        {company && (
          <span className="text-white/55 text-[11px] truncate max-w-[100px] font-medium">{company.name}</span>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main
        className="flex-1 md:ml-64 overflow-y-auto"
        style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top, 0px))',
          paddingBottom: '24px',
          minHeight: '100svh',
        }}
      >
        <div className="p-4 md:p-8 md:pt-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}