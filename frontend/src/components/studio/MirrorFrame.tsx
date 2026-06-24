export default function MirrorFrame({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="goldFrame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E9D8A6" />
          <stop offset="45%" stopColor="#C9A84A" />
          <stop offset="55%" stopColor="#F2E3B0" />
          <stop offset="100%" stopColor="#B08A2E" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="96"
        height="136"
        rx="10"
        stroke="url(#goldFrame)"
        strokeWidth="4"
      />
      <rect
        x="6"
        y="6"
        width="88"
        height="128"
        rx="7"
        stroke="url(#goldFrame)"
        strokeWidth="1.5"
        opacity="0.6"
      />
    </svg>
  );
}
