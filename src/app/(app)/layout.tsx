import { Suspense, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentMember } from "@/components/current-member";
import { TabBar } from "@/components/tab-bar";

/** Frame for all signed-in pages: header, content, tab bar (narrow screens). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] desk:px-6 desk:pb-12">
        <Suspense fallback={null}>
          <MemberGate>{children}</MemberGate>
        </Suspense>
      </main>
      <TabBar />
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
