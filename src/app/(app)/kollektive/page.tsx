import type { Metadata } from "next";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Kollektive – Krachparade Orga",
};

const plannedFeatures = [
  "Antworten aus dem Google-Formular automatisch übernommen",
  "Status je Kollektiv: Zahlung, TÜV, Telegram, Briefing, Paket, Pfand",
  "Ordner- und Westenbedarf aus dem Fahrzeugmix",
  "Keine Telefonnummern oder Kontodaten in der App",
];

export default function CollectivesPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Kollektive</PageTitle>
      <ComingSoon>Kommt mit Release R3</ComingSoon>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        {plannedFeatures.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  );
}
