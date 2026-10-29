/** Marca Cognis: três nós conectados (padrão, inferência, conclusão). */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--violet))" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke="url(#cg)" strokeWidth="2" />
      <path d="M9 21 L16 10 L23 21" fill="none" stroke="url(#cg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="21" r="2.6" fill="rgb(var(--accent))" />
      <circle cx="16" cy="10" r="2.6" fill="url(#cg)" />
      <circle cx="23" cy="21" r="2.6" fill="rgb(var(--violet))" />
    </svg>
  );
}
