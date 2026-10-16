/** An error message right at a field or control (spec 008). */
export function FieldError({ message }: { message?: string | null }) {
  return message ? (
    <p role="alert" className="text-sm font-medium text-status-late">
      {message}
    </p>
  ) : null;
}
