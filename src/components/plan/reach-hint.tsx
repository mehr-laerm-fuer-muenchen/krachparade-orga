/**
 * "Alle To-dos erledigt. Als erreicht markieren?" (spec 016): shown in the
 * panel and in the week list once all to-dos of an open element are done.
 * Nothing becomes reached by itself.
 */
export function ReachHint({ onReach, onDismiss }: { onReach: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border border-hint-border bg-hint-bg px-3 py-2">
      <p className="font-medium">Alle To-dos erledigt. Als erreicht markieren?</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReach}
          className="min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary hover:opacity-90"
        >
          Erreicht
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-surface-2"
        >
          Noch nicht
        </button>
      </div>
    </div>
  );
}
