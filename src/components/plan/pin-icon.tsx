// Pin for fixed dates (spec 026), in the Gantt label and on week list cards.

/** A pin, 10 × 12 units, drawn in `currentColor`. */
export const PIN_PATH =
  "M5 0a4 4 0 0 0-4 4c0 2.8 4 8 4 8s4-5.2 4-8a4 4 0 0 0-4-4zm0 5.6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z";

/**
 * Inline pin with the hidden word "fest" for screen readers; without
 * `label` where the text next to it already says "fest".
 */
export function PinIcon({ label = true }: { label?: boolean }) {
  return (
    <>
      <svg aria-hidden viewBox="0 0 10 12" className="inline-block h-3 w-2.5 shrink-0 align-[-1px]">
        <path d={PIN_PATH} fill="currentColor" fillRule="evenodd" />
      </svg>
      {label ? <span className="sr-only">fest </span> : null}
    </>
  );
}
