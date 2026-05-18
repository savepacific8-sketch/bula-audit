import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, Upload, Shield, X, CreditCard, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import BulaLogo from '@/components/layout/BulaLogo';
import BottomTabBar from '@/components/layout/BottomTabBar';
import MobileHeader from '@/components/layout/MobileHeader';

const navItems = [
  { path: '/',            label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts',    label: 'Receipts',  icon: Receipt },
  { path: '/reports',     label: 'Reports',   icon: FileText },
  { path: '/tax-reports', label: 'VAT',       icon: Shield, restricted: true },
  { path: '/team',        label: 'Team',      icon: Users },
  { path: '/company',     label: 'Company',   icon: Building2 },
  { path: '/billing',     label: 'Billing',   icon: CreditCard, ownerOnly: true },
  { path: '/admin-billing', label: 'Admin Billing', icon: ShieldCheck, adminOnly: true },
];

const ROOT_PATHS = ['/', '/receipts', '/reports', '/company', '/tax-reports', '/team', '/billing', '/admin-billing'];

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
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
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
            style={{ userSelect: 'none', WebkitUserSelect: 'none', background: 'hsl(var(--accent))' }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-4 shadow-md"
          >
            <Upload className="w-4 h-4 shrink-0" />
            Upload Receipt
          </Link>
        )}
      </nav>

      <div className="px-3 pb-6 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/45 hover:bg-white/8 hover:text-white/80 w-full transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: -10, transition: { duration: 0.15, ease: 'easeIn' } },
};

export default function AppLayout() {
  const location = useLocation();
  const { company, userRole, canUpload } = useCompany();
  const [appUserRole, setAppUserRole] = useState(null);
  // Load base44 app-level role for admin-only nav items
  useState(() => { base44.auth.me().then(u => setAppUserRole(u?.role)).catch(() => {}); });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isRoot = ROOT_PATHS.includes(location.pathname);

  const filteredNav = navItems.filter(item => {
    if (item.path === '/team' && userRole !== 'owner' && userRole !== 'manager') return false;
    if (item.restricted && userRole !== 'owner' && userRole !== 'manager' && userRole !== 'accountant') return false;
    if (item.ownerOnly && userRole !== 'owner' && userRole !== 'accountant') return false;
    if (item.adminOnly && appUserRole !== 'admin') return false;
    return true;
  });

  return (
    <div
      className="bg-background flex"
      style={{
        minHeight: '100svh',
        overscrollBehavior: 'none',
        WebkitOverscrollBehavior: 'none',
      }}
    >
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 fixed h-full z-30">
        <Sidebar filteredNav={filteredNav} company={company} canUpload={canUpload} onNavigate={() => {}} />
      </aside>

      {/* ── Mobile Drawer (for non-tab items) ───────────────────── */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              key="backdrop"
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="md:hidden fixed top-0 left-0 h-full z-50 w-72"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="absolute top-4 right-4 z-10 text-white/60 hover:text-white"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                <X className="w-5 h-5" />
              </button>
              <Sidebar filteredNav={filteredNav} company={company} canUpload={canUpload} onNavigate={() => setMobileDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile Top Header ───────────────────────────────────── */}
      <MobileHeader company={company} />

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main
        className="flex-1 md:ml-64 overflow-y-auto"
        style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top, 0px))',
          paddingBottom: isRoot ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : '24px',
          minHeight: '100svh',
          overscrollBehavior: 'none',
        }}
      >
        <div className="p-4 md:p-8 md:pt-6 max-w-6xl mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Bottom Tab Bar (mobile only) ─────────────────────────── */}
      <BottomTabBar />
    </div>
  );
}