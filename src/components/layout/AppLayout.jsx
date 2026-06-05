import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Receipt, FileText, Users, Building2, LogOut, Shield,
  X, CreditCard, ShieldCheck, Settings as SettingsIcon, ScrollText, UserCircle,
  MailWarning,
} from 'lucide-react';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import BulaLogo from '@/components/layout/BulaLogo';
import BottomTabBar from '@/components/layout/BottomTabBar';
import MobileHeader from '@/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/receipts',      label: 'Receipts',      icon: Receipt },
  { path: '/reports',       label: 'Reports',       icon: FileText },
  { path: '/tax-reports',   label: 'VAT',           icon: Shield, restricted: true },
  { path: '/team',          label: 'Team',          icon: Users, managerOrOwner: true },
  { path: '/company',       label: 'Company',       icon: Building2 },
  { path: '/billing',       label: 'Billing',       icon: CreditCard, ownerOnly: true },
  { path: '/admin-billing', label: 'Admin Billing', icon: ShieldCheck, adminOnly: true },
];

const accountItems = [
  { path: '/settings',  label: 'Settings',  icon: SettingsIcon },
  { path: '/audit-log', label: 'Audit Log', icon: ScrollText, adminOnly: true },
];

const ROOT_PATHS = ['/', '/receipts', '/reports', '/company', '/tax-reports', '/team', '/billing', '/admin-billing'];

function Sidebar({ filteredNav, filteredAccount, company, canUpload, user, onNavigate, onLogout }) {
  const location = useLocation();

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
        {filteredNav.map(item => (
          <NavLink key={item.path} item={item} active={location.pathname === item.path} onNavigate={onNavigate} />
        ))}

        {filteredAccount.length > 0 && (
          <>
            <div className="px-3 mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">Account</div>
            {filteredAccount.map(item => (
              <NavLink key={item.path} item={item} active={location.pathname === item.path} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>

      {/* User card + sign-out */}
      <div className="px-3 pb-6 border-t border-white/10 pt-3">
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-5 h-5 text-white/70" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.full_name || user.email}</p>
              <p className="text-white/40 text-[10px] truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onLogout()}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/55 hover:bg-white/8 hover:text-white w-full transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function NavLink({ item, active, onNavigate }) {
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
        active
          ? 'bg-white/15 text-white border border-white/10 shadow-sm'
          : 'text-white/55 hover:bg-white/8 hover:text-white/85'
      }`}
    >
      <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-white/45'}`} />
      <span className="flex-1">{item.label}</span>
      {active && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'hsl(var(--accent))' }} />
      )}
    </Link>
  );
}

function EmailVerifyBanner({ user }) {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState(null);
  if (!user || user.email_verified !== false) return null;

  const consoleMode = user.email_delivery === 'console';

  const resend = async () => {
    setResending(true);
    setDevVerifyUrl(null);
    try {
      const result = await base44.auth.resendVerification();
      setSent(true);
      if (result?.verify_url) setDevVerifyUrl(result.verify_url);
    } catch {
      // silent — user can retry
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
      <MailWarning className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-xs">
        <p className="font-semibold text-amber-900">Verify your email</p>
        <p className="text-amber-800 mt-0.5">
          {consoleMode && !sent && (
            <>Local dev: emails are not sent to your inbox. Click <strong>Resend</strong> to get a verification link here.</>
          )}
          {consoleMode && sent && !devVerifyUrl && (
            <>Check the <strong>server terminal</strong> (where <code className="text-[10px]">npm run dev</code> runs) for a line starting with <code className="text-[10px]">[verify-email] link</code>.</>
          )}
          {!consoleMode && sent && 'Check your inbox (and spam) for the verification link.'}
          {!consoleMode && !sent && `We sent a link to ${user.email}. Click it to confirm.`}
        </p>
        {devVerifyUrl && (
          <p className="mt-2">
            <a href={devVerifyUrl} className="text-amber-900 font-medium underline break-all">
              Click here to verify your email
            </a>
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100"
        onClick={resend}
        disabled={resending}
      >
        {resending ? 'Sending...' : sent ? 'Resend again' : 'Resend'}
      </Button>
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
  const { user, logout } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isRoot = ROOT_PATHS.includes(location.pathname);

  // Close drawer on route change
  useEffect(() => { setMobileDrawerOpen(false); }, [location.pathname]);

  const isAdmin = user?.role === 'admin';

  const filteredNav = navItems.filter(item => {
    if (item.managerOrOwner && userRole !== 'owner' && userRole !== 'manager') return false;
    if (item.restricted && userRole !== 'owner' && userRole !== 'manager' && userRole !== 'accountant') return false;
    if (item.ownerOnly && userRole !== 'owner' && userRole !== 'accountant') return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const filteredAccount = accountItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed h-full z-30">
        <Sidebar
          filteredNav={filteredNav}
          filteredAccount={filteredAccount}
          company={company}
          canUpload={canUpload}
          user={user}
          onNavigate={() => {}}
          onLogout={() => logout()}
        />
      </aside>

      {/* Mobile Drawer */}
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
                className="absolute top-4 right-4 z-10 text-white/70 hover:text-white"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
              <Sidebar
                filteredNav={filteredNav}
                filteredAccount={filteredAccount}
                company={company}
                canUpload={canUpload}
                user={user}
                onNavigate={() => setMobileDrawerOpen(false)}
                onLogout={() => { setMobileDrawerOpen(false); logout(); }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Top Header */}
      <MobileHeader company={company} onMenuClick={() => setMobileDrawerOpen(true)} />

      {/* Main */}
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
          <EmailVerifyBanner user={user} />
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

      <BottomTabBar />
    </div>
  );
}
