// Placeholder Privacy + Terms pages. Replace the content with your real
// legal copy before launch — these are starting points, not legal advice.

import { Link } from 'react-router-dom';
import BulaLogo from '@/components/layout/BulaLogo';

function Frame({ title, children }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <BulaLogo size={28} />
            <span className="font-poppins font-bold">BULA AUDIT</span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-slate">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-xs text-muted-foreground mb-6">
          Effective date: {new Date().toISOString().slice(0, 10)} — Draft, not legal advice.
        </p>
        {children}
        <div className="mt-10 text-sm text-muted-foreground">
          Contact: <a href="mailto:support@bulaaudit.com.fj">support@bulaaudit.com.fj</a>
        </div>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <Frame title="Privacy Policy">
      <h2>What we collect</h2>
      <ul>
        <li>Your name, email, and any photo you choose to share via Google sign-in.</li>
        <li>Company details you enter: business name, TIN, address, contact info.</li>
        <li>Receipt images you upload and the data we extract from them (supplier, amount, VAT, etc.).</li>
        <li>Usage data: IP address, browser/device, when you sign in and what actions you take.</li>
      </ul>

      <h2>What we use it for</h2>
      <ul>
        <li>To provide the BULA AUDIT service: storing and organizing your receipts and VAT records.</li>
        <li>To send essential service emails (password reset, verification, payment).</li>
        <li>To improve the service, fix bugs, and detect abuse.</li>
        <li>To comply with the Fiji Revenue and Customs Service (FRCS) record-retention requirements.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>Service providers we use to run BULA AUDIT (cloud hosting, database, email, AI receipt processing).</li>
        <li>Other members of your team, with role-based access controls (owners and managers see all receipts; staff see only their own).</li>
        <li>Authorities, when required by law (FRCS audits, court orders).</li>
        <li>We do not sell your data to advertisers.</li>
      </ul>

      <h2>Where data lives</h2>
      <p>
        Your data is stored on managed services hosted in the Asia-Pacific region (Sydney or Singapore).
        Receipt images are kept in encrypted object storage.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Receipts and related accounting records are kept for at least <strong>7 years</strong> from the
        date of creation, in line with FRCS retention rules. You may request deletion of personal data
        (name, email) at any time — see "Your rights" below.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Access: ask us for a copy of your data.</li>
        <li>Correction: update your profile or company info at any time inside the app.</li>
        <li>Deletion: ask us to delete your personal data. Accounting records retained for FRCS will be anonymized rather than removed.</li>
        <li>Export: download your data via the in-app export tools.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use one essential cookie (your sign-in token) and one for refresh sessions.
        We do not use tracking or advertising cookies.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make material changes we will notify signed-in users by email and update the effective
        date above.
      </p>
    </Frame>
  );
}

export function Terms() {
  return (
    <Frame title="Terms of Service">
      <h2>Acceptance</h2>
      <p>
        By using BULA AUDIT you agree to these terms. If you don't agree, please don't use the service.
      </p>

      <h2>The service</h2>
      <p>
        BULA AUDIT is a receipt management and VAT tracking app for Fiji small businesses.
        We provide it on an "as-is" basis without warranty of fitness for any particular purpose.
        We do our best to keep it running, but we don't guarantee uninterrupted availability.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You're responsible for keeping your password and devices secure.</li>
        <li>You're responsible for the accuracy of data you enter, including VAT calculations.</li>
        <li>Don't share your account with people outside your business.</li>
        <li>Tell us promptly if you suspect unauthorized access.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don't upload content that isn't yours or that you're not authorized to use.</li>
        <li>Don't try to break, abuse, or reverse-engineer the service.</li>
        <li>Don't use it for anything illegal.</li>
      </ul>

      <h2>VAT and accounting accuracy</h2>
      <p>
        BULA AUDIT uses AI to help extract data from receipts. The AI can make mistakes. <strong>You are
        responsible for verifying every figure before submitting any tax return or accounting record.</strong>
        We are not a substitute for an accountant.
      </p>

      <h2>Payments</h2>
      <p>
        Paid plans are billed monthly or annually as shown in the app. Payments are non-refundable
        except where required by Fiji law.
      </p>

      <h2>Termination</h2>
      <p>
        You can close your account at any time. We can suspend or terminate accounts that violate these
        terms. Accounting records will be retained per FRCS rules.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent allowed by Fiji law, our total liability to you is limited to the amount
        you paid us for the service in the 12 months before the issue arose.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of Fiji. Disputes are subject to the courts of Fiji.
      </p>
    </Frame>
  );
}
