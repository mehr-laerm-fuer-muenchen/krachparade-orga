import { ITEM_KIND_LABELS, type ItemKind } from "@/lib/protocol-rules";

const KIND_CLASS: Record<ItemKind, string> = {
  info: "bg-kind-info text-on-kind-info",
  diskussion: "bg-kind-discussion text-on-kind-discussion",
  entscheidung: "bg-kind-decision text-on-kind-decision",
  todo: "bg-kind-todo text-on-kind-todo",
};

/** Kind of a protocol item (spec 004). */
export function ItemKindBadge({ kind }: { kind: ItemKind }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_CLASS[kind]}`}
    >
      {ITEM_KIND_LABELS[kind]}
    </span>
  );
}

