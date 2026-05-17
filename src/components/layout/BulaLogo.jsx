/**
 * BulaLogo – SVG logomark for BULA AUDIT.
 * A stylised sun-over-wave mark in teal + coral, inspired by
 * Fiji's ocean horizon and masi geometry. Clean and professional.
 */
export default function BulaLogo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bula Audit logo"
    >
      {/* ── Background rounded square ── */}
      <rect width="32" height="32" rx="8" fill="url(#bg)" />

      {/* ── Sun circle (coral) ── */}
      <circle cx="16" cy="13" r="5.5" fill="#F97316" opacity="0.92" />

      {/* ── Sun rays (4 short masi-style lines) ── */}
      <line x1="16" y1="5"   x2="16" y2="3"   stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <line x1="16" y1="21"  x2="16" y2="23"  stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <line x1="8"  y1="13"  x2="6"  y2="13"  stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <line x1="24" y1="13"  x2="26" y2="13"  stroke="#F97316" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />

      {/* ── Wave band at the bottom ── */}
      {/* Base fill */}
      <rect x="0" y="21" width="32" height="11" rx="0" fill="#0F7170" opacity="0.45" />
      <path
        d="M0 23 C4 21, 8 25, 12 23 C16 21, 20 25, 24 23 C26.5 22, 29 23.5, 32 23 L32 32 L0 32 Z"
        fill="#0F7170"
        opacity="0.6"
      />
      <path
        d="M0 26 C5 24, 9 27.5, 14 26 C18 24.5, 22 27.5, 27 26 C29 25.5, 30.5 26.5, 32 26 L32 32 L0 32 Z"
        fill="#0F7170"
        opacity="0.85"
      />

      {/* ── Bottom-left masi corner mark ── */}
      <rect x="3" y="28" width="4" height="1.5" rx="0.5" fill="white" opacity="0.25" />
      <rect x="3" y="25.5" width="1.5" height="4" rx="0.5" fill="white" opacity="0.25" />

      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D4F6C" />
          <stop offset="100%" stopColor="#0A3A50" />
        </linearGradient>
      </defs>
    </svg>
  );
}