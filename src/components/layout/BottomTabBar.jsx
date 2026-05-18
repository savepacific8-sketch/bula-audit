import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Building2, CreditCard } from 'lucide-react';
import { useCompany } from '@/lib/useCompanyContext.jsx';

const ALL_TABS = [
  { path: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts', label: 'Receipts',  icon: Receipt },
  { path: '/reports',  label: 'Reports',   icon: FileText },
  { path: '/billing',  label: 'Billing',   icon: CreditCard, ownerOnly: true },
  { path: '/company',  label: 'Company',   icon: Building2 },
];

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole } = useCompany();

  const tabs = ALL_TABS.filter(t => {
    if (t.ownerOnly && userRole !== 'owner' && userRole !== 'accountant') return false;
    return true;
  });

  const rootPaths = tabs.map(t => t.path);
  const isRootRoute = rootPaths.includes(location.pathname);
  if (!isRootRoute) return null;

  const handleTabPress = (path) => {
    if (location.pathname === path) {
      // Already active — scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => handleTabPress(path)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors duration-150"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            />
            <span
              className="text-[10px] font-medium"
              style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            >
              {label}
            </span>
            {active && (
              <span
                className="absolute top-0 w-8 h-0.5 rounded-b-full"
                style={{ background: 'hsl(var(--primary))' }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}