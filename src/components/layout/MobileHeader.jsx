import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import BulaLogo from '@/components/layout/BulaLogo';

const ROOT_PATHS = ['/', '/receipts', '/reports', '/company', '/tax-reports', '/team'];

const ROUTE_TITLES = {
  '/upload': 'Upload Receipt',
  '/receipt-review': 'Review Receipt',
  '/receipt-scanner': 'AI Scanner',
  '/tax-reports': 'VAT Summary',
  '/team': 'Team',
};

export default function MobileHeader({ company }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isRoot = ROOT_PATHS.includes(location.pathname);
  const title = ROUTE_TITLES[location.pathname] || '';

  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 masi-pattern wave-pattern"
      style={{
        background: 'hsl(var(--fiji-deep))',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        paddingBottom: '10px',
        minHeight: '52px',
      }}
    >
      {isRoot ? (
        /* Root: show logo + app name */
        <div className="flex items-center gap-2 flex-1">
          <BulaLogo size={24} />
          <span className="text-white font-poppins font-bold text-base tracking-wide">BULA AUDIT</span>
          {company && (
            <span className="text-white/45 text-[11px] truncate ml-auto max-w-[110px] font-medium">{company.name}</span>
          )}
        </div>
      ) : (
        /* Child route: show back button + title */
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
        </>
      )}
    </div>
  );
}