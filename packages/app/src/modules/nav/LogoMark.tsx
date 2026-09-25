// The platform's mark: three stacked layers (a platform built on layers of
// infrastructure) on an indigo→cyan tile. The same shapes are in
// public/favicon.svg — keep the two in sync.
export const LogoMark = ({ gradientId }: { gradientId: string }) => (
  <>
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32">
        <stop offset="0" stopColor="#6366f1" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="7" fill={`url(#${gradientId})`} />
    <path d="M16 6.5 26 11.5 16 16.5 6 11.5Z" fill="#fff" />
    <path
      d="M6 16 16 21 26 16"
      fill="none"
      stroke="#fff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 20.5 16 25.5 26 20.5"
      fill="none"
      stroke="#fff"
      strokeOpacity="0.6"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);
