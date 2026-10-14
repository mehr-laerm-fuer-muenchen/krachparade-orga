import type { Metadata } from "next";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Protokolle – Krachparade Orga",
};

export default function MinutesPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Protokolle</PageTitle>
      <ComingSoon>Kommt mit Spec 004</ComingSoon>
    </div>
  );
}
