import type { Metadata } from "next";
import { PageTitle } from "@/components/placeholder";
import { PRIVACY_HTML } from "./privacy-html";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Krachparade Orga",
};

/**
 * Privacy policy (spec 035). Public, because Google links it from the OAuth
 * consent screen and the collectives see it before registering. The text is
 * a static constant from this repo, never user input.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] desk:px-6">
      <PageTitle>Datenschutzerklärung</PageTitle>
      <div
        className="flex flex-col gap-3 break-words [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_.seal]:mt-4 [&_.seal]:text-sm"
        dangerouslySetInnerHTML={{ __html: PRIVACY_HTML }}
      />
    </main>
  );
}
