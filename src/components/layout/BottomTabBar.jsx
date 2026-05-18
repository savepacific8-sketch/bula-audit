import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, FileText, Building2 } from 'lucide-react';

const tabs = [
  { path: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receipts', label: 'Receipts',  icon: Receipt },
  { path: '/reports',  label: 'Reports',   icon: FileText },
  { path: '/company',  label: 'Company',   icon: Building2 },
];

export default function BottomTabBar() {
  const location = useLocation();

  // Only show on root routes
  const rootPaths = tabs.map(t => t.path);
  const isRootRoute = rootPaths.includes(location.pathname);
  if (!isRootRoute) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors duration-150"
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
          </Link>
        );
      })}
    </nav>
  );
}