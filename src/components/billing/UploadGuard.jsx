import { useSubscription } from '@/hooks/useSubscription';
import { useCompany } from '@/lib/useCompanyContext.jsx';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowUpCircle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Wrap any upload entry point.
 * Blocks uploads when limit is reached or subscription is expired/suspended.
 */
export default function UploadGuard({ children }) {
  const { uploadAllowed, limitReached, isExpired, isFreePlan, receiptsRemaining, receiptLimit, subscription } = useSubscription();
  const { userRole } = useCompany();

  if (uploadAllowed) return children;

  const showUpgrade = userRole === 'owner';

  let title = 'Upload Not Available';
  let message = 'You cannot upload receipts at the moment.';

  if (limitReached && isFreePlan) {
    title = 'Free Plan Limit Reached';
    message = `You have used all ${receiptLimit} free receipt uploads. Please subscribe to continue uploading receipts.`;
  } else if (limitReached) {
    title = 'Monthly Receipt Limit Reached';
    message = `You have reached your monthly receipt limit. Upgrade your plan to continue uploading receipts.`;
  } else if (subscription?.status === 'overdue') {
    title = 'Payment Overdue';
    message = 'Your subscription payment is overdue. Receipt uploads are paused until payment is confirmed.';
  } else if (isExpired || subscription?.status === 'suspended') {
    title = subscription?.status === 'suspended' ? 'Account Suspended' : 'Subscription Expired';
    message = 'Your subscription has ended. You can still view your data, but uploads are paused until you renew.';
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