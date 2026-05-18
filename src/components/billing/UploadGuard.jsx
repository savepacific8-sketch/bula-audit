import { useSubscription } from '@/hooks/useSubscription';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowUpCircle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Wrap any upload entry point.
 * If uploads are not allowed (limit reached / expired / suspended),
 * renders a friendly block message instead of children.
 */
export default function UploadGuard({ children }) {
  const { uploadAllowed, limitReached, isExpired, subscription } = useSubscription();
  const { userRole } = useCompany();

  if (uploadAllowed) return children;

  let title = 'Upload Not Available';
  let message = 'You cannot upload receipts at the moment.';
  let showUpgrade = userRole === 'owner';

  if (limitReached) {
    title = 'Monthly Limit Reached';
    message = `You've used all your receipts for this month. Upgrade your plan to upload more.`;
  } else if (isExpired || subscription?.status === 'suspended') {
    title = subscription?.status === 'suspended' ? 'Account Suspended' : 'Subscription Expired';
    message = 'Your subscription is not active. Please renew to continue uploading receipts.';
  } else if (!subscription) {
    title = 'No Active Plan';
    message = 'Choose a subscription plan to start uploading receipts.';
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
        {limitReached ? <AlertTriangle className="w-7 h-7 text-amber-600" /> : <Lock className="w-7 h-7 text-amber-600" />}
      </div>
      <div>
        <p className="font-bold text-foreground text-base">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{message}</p>
      </div>
      {showUpgrade && (
        <Button asChild className="gap-2">
          <Link to="/billing">
            <ArrowUpCircle className="w-4 h-4" /> View Plans
          </Link>
        </Button>
      )}
    </div>
  );
}