import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu } from 'lucide-react';
import BulaLogo from '@/components/layout/BulaLogo';

const ROOT_PATHS = ['/', '/receipts', '/reports', '/company', '/tax-reports', '/team', '/billing', '/admin-billing'];

const ROUTE_TITLES = {
  '/upload':          'Upload Receipt',
  '/receipt-review':  'Review Receipt',
  '/receipt-scanner': 'AI Scanner',
  '/tax-reports':     'VAT Summary',
  '/team':            'Team',
  '/billing':         'Billing',
  '/admin-billing':   'Admin Billing',
  '/settings':        'Settings',
  '/audit-log':       'Audit Log',
};

export default function MobileHeader({ company, onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isRoot = ROOT_PATHS.includes(location.pathname);
  const title = ROUTE_TITLES[location.pathname] || '';

  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-3 masi-pattern wave-pattern"
      style={{
        background: 'hsl(var(--fiji-deep))',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        paddingBottom: '10px',
        minHeight: '52px',
      }}
    >
      {isRoot ? (
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BulaLogo size={24} />
            <span className="text-white font-poppins font-bold text-base tracking-wide">BULA AUDIT</span>
            {company && (
              <span className="text-white/45 text-[11px] truncate ml-2 max-w-[110px] font-medium">{company.name}</span>
            )}
          </div>
          <button
            onClick={onMenuClick}
            className="ml-2 p-2 rounded-lg text-white/85 hover:bg-white/10 active:bg-white/15 transition-colors shrink-0"
            aria-label="Open menu"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <Menu className="w-5 h-5" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-white/80 hover:text-white mr-3 transition-colors"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <span className="text-white font-semibold text-base flex-1 truncate">{title}</span>
          <button
            onClick={onMenuClick}
            className="ml-2 p-2 rounded-lg text-white/85 hover:bg-white/10 active:bg-white/15 transition-colors shrink-0"
            aria-label="Open menu"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <Menu className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
