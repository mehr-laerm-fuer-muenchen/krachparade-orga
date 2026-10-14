import type { Metadata } from "next";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Kollektive – Krachparade Orga",
};

export default function CollectivesPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Kollektive</PageTitle>
      <ComingSoon>Kommt mit Release R3</ComingSoon>
    </div>
  );
}
