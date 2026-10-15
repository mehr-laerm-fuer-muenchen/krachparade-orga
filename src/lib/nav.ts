export type NavItem = {
  href: string;
  label: string;
  /** Small marker for features that come later, e.g. "R3". */
  badge?: string;
};

/** Main navigation in the header (wide screens), in this order. */
export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", label: "Plan" },
  { href: "/arbeitskreise", label: "AKs" },
  { href: "/protokolle", label: "Protokolle" },
  { href: "/meine", label: "Meine Aufgaben" },
  { href: "/kollektive", label: "Kollektive", badge: "R3" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export type TabItem = {
  href: string;
  label: string;
  /** Further sections that mark this tab as active. */
  alsoActiveFor?: readonly string[];
};

/** Bottom tab bar (narrow screens). "Mehr" holds Kollektive and Abmelden. */
export const TAB_NAV: readonly TabItem[] = [
  { href: "/", label: "Plan" },
  { href: "/arbeitskreise", label: "AKs" },
  { href: "/protokolle", label: "Protokolle" },
  { href: "/meine", label: "Meine" },
  { href: "/einstellungen", label: "Mehr", alsoActiveFor: ["/kollektive"] },
];

/** True if `pathname` is `href` or one of its sub pages ("/" only matches itself). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isActiveTab(pathname: string, tab: TabItem): boolean {
  return [tab.href, ...(tab.alsoActiveFor ?? [])].some((href) => isActivePath(pathname, href));
}
