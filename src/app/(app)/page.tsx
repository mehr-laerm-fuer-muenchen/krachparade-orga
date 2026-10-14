import type { Metadata } from "next";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Überblick – Krachparade Orga",
};

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Weg zur Krachparade</PageTitle>
      <ComingSoon>Kommt mit Release R1</ComingSoon>
    </div>
  );
}
