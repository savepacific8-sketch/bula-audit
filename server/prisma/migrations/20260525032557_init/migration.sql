-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "fullName" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "currentCompanyId" TEXT,
    "currentCompanyRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tin" TEXT,
    "businessType" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatRate" REAL NOT NULL DEFAULT 12.5,
    "ownerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_ownerEmail_fkey" FOREIGN KEY ("ownerEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "supplierName" TEXT,
    "supplierTin" TEXT,
    "receiptNumber" TEXT,
    "receiptDate" DATETIME,
    "dueDate" DATETIME,
    "currency" TEXT DEFAULT 'FJD',
    "subtotal" REAL,
    "vatType" TEXT NOT NULL DEFAULT 'inclusive',
    "vatRate" REAL,
    "vatAmount" REAL,
    "totalAmount" REAL,
    "paymentMethod" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "category" TEXT,
    "itemLines" TEXT,
    "aiConfidence" REAL,
    "aiMissingFields" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "uploadedBy" TEXT,
    "reviewedBy" TEXT,
    "reviewedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Receipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "nextPaymentDate" DATETIME,
    "amountDue" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "proofUrl" TEXT NOT NULL,
    "proofFilename" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "amountPaid" REAL NOT NULL,
    "paymentDate" DATETIME,
    "referenceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedDate" DATETIME,
    "reviewNotes" TEXT,
    "submittedBy" TEXT,
    "planRequested" TEXT,
    "billingCycleRequested" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentProof_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentProof_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "Company_ownerEmail_idx" ON "Company"("ownerEmail");

-- CreateIndex
CREATE INDEX "TeamMember_companyId_idx" ON "TeamMember"("companyId");

-- CreateIndex
CREATE INDEX "TeamMember_userEmail_idx" ON "TeamMember"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_companyId_userEmail_key" ON "TeamMember"("companyId", "userEmail");

-- CreateIndex
CREATE INDEX "Receipt_companyId_idx" ON "Receipt"("companyId");

-- CreateIndex
CREATE INDEX "Receipt_uploadedBy_idx" ON "Receipt"("uploadedBy");

-- CreateIndex
CREATE INDEX "Receipt_receiptDate_idx" ON "Receipt"("receiptDate");

-- CreateIndex
CREATE INDEX "Subscription_companyId_idx" ON "Subscription"("companyId");

-- CreateIndex
CREATE INDEX "PaymentProof_companyId_idx" ON "PaymentProof"("companyId");

-- CreateIndex
CREATE INDEX "PaymentProof_subscriptionId_idx" ON "PaymentProof"("subscriptionId");

-- CreateIndex
CREATE INDEX "PaymentProof_submittedBy_idx" ON "PaymentProof"("submittedBy");
