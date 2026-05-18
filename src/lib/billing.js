/**
 * BULA AUDIT — Billing & Plans configuration
 */

export const PLANS = {
  free_trial: {
    key: 'free_trial',
    name: 'Free Trial',
    tagline: '14-day full access',
    price_monthly: 0,
    price_yearly: 0,
    receipt_limit: 20,
    user_limit: 1,
    trial_days: 14,
    color: 'hsl(210,12%,48%)',
    badge_class: 'bg-slate-100 text-slate-600 border-slate-200',
    features: [
      'Up to 20 receipts',
      '1 user (owner only)',
      'Basic dashboard',
      'AI extraction',
      'No export after trial',
    ],
    exports: false,
    pdf_reports: false,
    team_roles: false,
    accountant_access: false,
    multi_company: false,
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    tagline: 'Perfect for solo traders',
    price_monthly: 19,
    price_yearly: 182, // 2 months free
    receipt_limit: 100,
    user_limit: 2,
    color: 'hsl(178,58%,30%)',
    badge_class: 'bg-teal-50 text-teal-700 border-teal-200',
    features: [
      'Up to 100 receipts/month',
      '2 users',
      'Receipt upload & AI extraction',
      'VAT summary',
      'Basic reports',
      'CSV export',
    ],
    exports: true,
    pdf_reports: false,
    team_roles: false,
    accountant_access: false,
    multi_company: false,
  },
  business: {
    key: 'business',
    name: 'Business',
    tagline: 'Growing businesses',
    price_monthly: 49,
    price_yearly: 470, // 2 months free
    receipt_limit: 500,
    user_limit: 5,
    popular: true,
    color: 'hsl(20,88%,54%)',
    badge_class: 'bg-orange-50 text-orange-700 border-orange-200',
    features: [
      'Up to 500 receipts/month',
      '5 users',
      'Everything in Starter',
      'Team roles',
      'PDF reports',
      'Monthly reports',
      'Supplier & category reports',
    ],
    exports: true,
    pdf_reports: true,
    team_roles: true,
    accountant_access: false,
    multi_company: false,
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    tagline: 'Advanced analytics & compliance',
    price_monthly: 99,
    price_yearly: 950, // 2 months free
    receipt_limit: 1500,
    user_limit: 15,
    color: 'hsl(210,60%,45%)',
    badge_class: 'bg-blue-50 text-blue-700 border-blue-200',
    features: [
      'Up to 1,500 receipts/month',
      '15 users',
      'Everything in Business',
      'Advanced reports',
      'Accountant access',
      'Audit logs',
      'Priority support',
    ],
    exports: true,
    pdf_reports: true,
    team_roles: true,
    accountant_access: true,
    multi_company: false,
  },
  accountant: {
    key: 'accountant',
    name: 'Accountant',
    tagline: 'Manage multiple MSME clients',
    price_monthly: 199,
    price_yearly: 1910, // 2 months free
    receipt_limit: 5000,
    user_limit: 999, // accountant team
    company_limit: 10,
    color: 'hsl(270,50%,50%)',
    badge_class: 'bg-purple-50 text-purple-700 border-purple-200',
    features: [
      'Up to 5,000 receipts/month',
      '10 client companies',
      'Accountant team access',
      'Manage multiple MSME clients',
      'Export all reports',
      'VAT summaries per client',
      'Monthly reports',
    ],
    exports: true,
    pdf_reports: true,
    team_roles: true,
    accountant_access: true,
    multi_company: true,
  },
};

export const PLAN_ORDER = ['free_trial', 'starter', 'business', 'pro', 'accountant'];

export const PAYMENT_METHODS = [
  {
    value: 'mpaisa',
    label: 'M-PAiSA',
    icon: '📱',
    instructions: `1. Open your M-PAiSA app\n2. Select "Send Money"\n3. Enter the BULA AUDIT M-PAiSA number\n4. Enter the exact amount shown above\n5. Use your company name as the payment reference\n6. Take a screenshot of the confirmation screen\n7. Upload the screenshot below`,
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    icon: '🏦',
    instructions: `Transfer to:\n  Bank: BSP / ANZ / HFC (any Fiji bank)\n  Account Name: BULA AUDIT Ltd\n  Account Number: [provided on invoice]\n  Reference: Your company name\n\nAfter transferring, take a screenshot or save your receipt and upload it below.`,
  },
  {
    value: 'cash',
    label: 'Cash / Admin',
    icon: '💵',
    instructions: `Contact the BULA AUDIT team to arrange payment:\n  Email: billing@bulaaudit.com.fj\n\nOnce payment is received, our team will manually activate your subscription.`,
  },
];

export const STATUS_CONFIG = {
  trial:           { label: 'Free Trial',        color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200' },
  active:          { label: 'Active',            color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  pending_payment: { label: 'Pending Payment',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  overdue:         { label: 'Overdue',           color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  suspended:       { label: 'Suspended',         color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  cancelled:       { label: 'Cancelled',         color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

/**
 * Returns whether a subscription allows uploads.
 */
export function canUploadReceipts(subscription) {
  if (!subscription) return false;
  return ['trial', 'active', 'pending_payment'].includes(subscription.status);
}

/**
 * Returns whether a subscription allows exports.
 */
export function canExportReports(subscription) {
  if (!subscription) return false;
  if (!['trial', 'active'].includes(subscription.status)) return false;
  const plan = PLANS[subscription.plan];
  return plan?.exports ?? false;
}

/**
 * Monthly price depending on billing cycle.
 */
export function getPrice(planKey, cycle) {
  const plan = PLANS[planKey];
  if (!plan) return 0;
  return cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
}

/**
 * Human-readable price string.
 */
export function formatPlanPrice(planKey, cycle) {
  const price = getPrice(planKey, cycle);
  if (price === 0) return 'FJD $0';
  if (cycle === 'yearly') return `FJD $${price}/year`;
  return `FJD $${price}/month`;
}