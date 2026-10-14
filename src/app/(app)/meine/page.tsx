import type { Metadata } from "next";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Meine Aufgaben – Krachparade Orga",
};

export default function MyTasksPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Meine Aufgaben</PageTitle>
      <ComingSoon>Kommt mit Release R1</ComingSoon>
    </div>
  );
}
