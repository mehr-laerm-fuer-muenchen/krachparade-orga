import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { getCurrentMember } from "@/components/current-member";
import { MyOverdueBadge } from "@/components/my-overdue-badge";
import { TabBar } from "@/components/tab-bar";

/** Frame for all signed-in pages: header, content, tab bar (narrow screens). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  // Overdue count at "Meine" (spec 009), loaded here on the server.
  const badges = {
    "/meine": (
      <Suspense fallback={null}>
        <MyOverdueBadge />
      </Suspense>
    ),
  };
  return (
    <>
      <AppHeader badges={badges} />
      <AppMain>
        <Suspense fallback={null}>
          <MemberGate>{children}</MemberGate>
        </Suspense>
      </AppMain>
      <TabBar badges={badges} />
    </>
  );
}

/**
 * Checks the signed-in member against the database on every request (missing
 * or deactivated → /login) before any page content is shown.
 */
async function MemberGate({ children }: { children: ReactNode }) {
  await getCurrentMember();
  return children;
}
