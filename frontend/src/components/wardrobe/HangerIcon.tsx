export default function HangerIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 9c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.5-.8 2.6-2 3.2" />
      <path d="M24 9 4 22a2 2 0 0 0 1.1 3.6h37.8A2 2 0 0 0 44 22L24 9Z" />
    </svg>
  );
}
