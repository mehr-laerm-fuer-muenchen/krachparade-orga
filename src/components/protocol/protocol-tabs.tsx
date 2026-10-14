import Link from "next/link";

const TABS = [
  { key: "treffen", href: "/protokolle", label: "Treffen" },
  { key: "beschluesse", href: "/protokolle/beschluesse", label: "Beschlüsse" },
  { key: "todos", href: "/protokolle/todos", label: "To-dos" },
] as const;

/** Tabs at the top of the protocol pages (spec 004). */
export function ProtocolTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Protokoll-Bereiche" className="border-b border-line">
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center border-b-2 px-3 font-medium ${
                  current ? "border-primary text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Entwurf" or "Final" – only a marker, it locks nothing. */
export function MeetingStatusMark({ status }: { status: string }) {
  const final = status === "final";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        final ? "bg-status-done text-on-status-done" : "border border-line-strong text-muted"
      }`}
    >
      {final ? "Final" : "Entwurf"}
    </span>
  );
}
