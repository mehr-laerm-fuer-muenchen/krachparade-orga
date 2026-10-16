function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The box for ticking off on "/meine" (spec 009) and in the week list (spec
 * 016): a 44 px wide button with role "checkbox", stretched to the card's height.
 */
export function TickBox({
  checked,
  label,
  onToggle,
  className = "",
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`flex w-11 shrink-0 items-center justify-center hover:bg-surface-2 ${className}`}
    >
      <span
        className={`flex size-5 items-center justify-center rounded border-2 ${
          checked ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface"
        }`}
      >
        {checked ? <CheckIcon /> : null}
      </span>
    </button>
  );
}
