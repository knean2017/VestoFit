export default function HookIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="5" rx="1.5" />
      <path d="M12 7v9a5 5 0 0 1-5 5" />
      <circle cx="6" cy="22" r="2.2" />
    </svg>
  );
}
