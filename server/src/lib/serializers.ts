// Convert DB rows to the shape the frontend already expects (snake_case +
// parsed JSON for itemLines / aiMissingFields). This keeps the API close to
// the original Base44 entity shape so frontend changes are smaller.

import type {
  Company,
  TeamMember,
  Receipt,
  Subscription,
  PaymentProof,
} from '@prisma/client';

function tryParseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function serializeCompany(c: Company) {
  return {
    id: c.id,
    name: c.name,
    tin: c.tin,
    business_type: c.businessType,
    phone: c.phone,
    email: c.email,
    address: c.address,
    vat_registered: c.vatRegistered,
    vat_rate: c.vatRate,
    owner_email: c.ownerEmail,
    created_date: c.createdAt.toISOString(),
    updated_date: c.updatedAt.toISOString(),
  };
}

export function serializeTeamMember(t: TeamMember) {
  return {
    id: t.id,
    company_id: t.companyId,
    user_email: t.userEmail,
    user_name: t.userName,
    role: t.role,
    status: t.status,
    created_date: t.createdAt.toISOString(),
    updated_date: t.updatedAt.toISOString(),
  };
}

export function serializeReceipt(r: Receipt) {
  return {
    id: r.id,
    company_id: r.companyId,
    photo_url: r.photoUrl,
    document_url: r.documentUrl,
    document_name: r.documentName,
    supplier_name: r.supplierName,
    supplier_tin: r.supplierTin,
    receipt_number: r.receiptNumber,
    receipt_date: r.receiptDate?.toISOString().slice(0, 10) ?? null,
    due_date: r.dueDate?.toISOString().slice(0, 10) ?? null,
    currency: r.currency,
    subtotal: r.subtotal,
    vat_type: r.vatType,
    vat_rate: r.vatRate,
    vat_amount: r.vatAmount,
    total_amount: r.totalAmount,
    payment_method: r.paymentMethod,
    payment_status: r.paymentStatus,
    category: r.category,
    item_lines: tryParseJson(r.itemLines) ?? [],
    ai_confidence: r.aiConfidence,
    ai_missing_fields: tryParseJson(r.aiMissingFields) ?? [],
    status: r.status,
    notes: r.notes,
    uploaded_by: r.uploadedBy,
    reviewed_by: r.reviewedBy,
    reviewed_date: r.reviewedDate?.toISOString() ?? null,
    created_date: r.createdAt.toISOString(),
    updated_date: r.updatedAt.toISOString(),
    deleted_date: r.deletedAt?.toISOString() ?? null,
  };
}

export function serializeSubscription(s: Subscription) {
  return {
    id: s.id,
    company_id: s.companyId,
    plan: s.plan,
    billing_cycle: s.billingCycle,
    status: s.status,
    start_date: s.startDate?.toISOString().slice(0, 10) ?? null,
    end_date: s.endDate?.toISOString().slice(0, 10) ?? null,
    next_payment_date: s.nextPaymentDate?.toISOString().slice(0, 10) ?? null,
    amount_due: s.amountDue,
    notes: s.notes,
    created_date: s.createdAt.toISOString(),
    updated_date: s.updatedAt.toISOString(),
  };
}

export function serializePaymentProof(p: PaymentProof) {
  return {
    id: p.id,
    company_id: p.companyId,
    subscription_id: p.subscriptionId,
    proof_url: p.proofUrl,
    proof_filename: p.proofFilename,
    payment_method: p.paymentMethod,
    amount_paid: p.amountPaid,
    payment_date: p.paymentDate?.toISOString().slice(0, 10) ?? null,
    reference_number: p.referenceNumber,
    status: p.status,
    reviewed_by: p.reviewedBy,
    reviewed_date: p.reviewedDate?.toISOString() ?? null,
    review_notes: p.reviewNotes,
    submitted_by: p.submittedBy,
    plan_requested: p.planRequested,
    billing_cycle_requested: p.billingCycleRequested,
    created_date: p.createdAt.toISOString(),
    updated_date: p.updatedAt.toISOString(),
  };
}
