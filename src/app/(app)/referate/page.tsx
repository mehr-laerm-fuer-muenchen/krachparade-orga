import type { Metadata } from "next";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Referate – Krachparade Orga",
};

export default function DepartmentsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Referate</PageTitle>
      <ComingSoon>Kommt mit Release R1</ComingSoon>
    </div>
  );
}
