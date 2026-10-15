// KP27 template (spec 010): the processes from the KP26 sheet with the changes
// decided on 14.10.2026. Data only, no database access; created by the seed
// with --prod while the current edition has no plan element. No people.
import type { PlanTemplateElement, PlanTemplateNote, PlanTemplateTodo } from "./seed";

export const KP27_PLAN: PlanTemplateElement[] = [
  { name: "Voranmeldung geöffnet", group: "Kommunikation", kind: "milestone", department: "Kommunikation E-Mails", next: [{ to: "Vortreffen Kollektive", lag: 20 }] },
  { name: "Vortreffen Kollektive", group: "Kommunikation", kind: "milestone", department: "Kollektiv-Chats", next: [{ to: "Anmeldung offen", lag: 7 }] },
  { name: "Anmeldung offen", group: "Kommunikation", kind: "task", durationDays: 21, department: "Kommunikation E-Mails", next: [{ to: "Auswahlkommission", lag: 0 }] },
  { name: "Auswahlkommission", group: "Demo & Route", kind: "task", durationDays: 10, department: "Demoleitung", next: [{ to: "Finale Zusage an Kollektive", lag: 0 }] },
  { name: "Finale Zusage an Kollektive", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Zahlungsfrist Kollektive", lag: 0 }, { to: "Soundkopplung · Termin 1", lag: 7 }] },
  { name: "Zahlungsfrist Kollektive", group: "Finanzen", kind: "task", durationDays: 23, department: "Finanzen", next: [{ to: null, lag: 57 }] },
  { name: "Soundkopplung · Termin 1", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", next: [{ to: "Soundkopplung · Termin 2", lag: 45 }] },
  { name: "Soundkopplung · Termin 2", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", next: [{ to: "Soundkopplung · Termin 3", lag: 25 }] },
  { name: "Soundkopplung · Termin 3", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", next: [{ to: null, lag: 3 }] },
  { name: "Pressemitteilung Vorbericht", group: "Kommunikation", kind: "milestone", department: "Pressearbeit", next: [{ to: null, lag: 60 }] },
  { name: "T-Shirt-Bestellung", group: "Flächen & Technik", kind: "milestone", department: "Ressourcen / Material", next: [{ to: null, lag: 49 }] },
  { name: "Schildermalen", group: "Kommunikation", kind: "milestone", department: "Social Media", next: [{ to: null, lag: 34 }] },
  { name: "Finaler Planungscheck", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Finaler Crosscheck", lag: 7 }] },
  { name: "Rechtliches fertig", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Sicherheitskonzept fertig", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Programm fertig", group: "Programm", kind: "milestone", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Logistik fertig", group: "Flächen & Technik", kind: "milestone", department: "Ressourcen / Material", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "PR fertig", group: "Kommunikation", kind: "milestone", department: "Pressearbeit", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Finaler Crosscheck", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Briefing Abschnittsleitungen", lag: 3 }] },
  { name: "Briefing Abschnittsleitungen", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Gesamtbriefing Wagenverantwortliche", lag: 4 }] },
  { name: "Wagenpakete packen", group: "Flächen & Technik", kind: "task", durationDays: 4, department: "Wagenpakete", next: [{ to: "Gesamtbriefing Wagenverantwortliche", lag: 0 }] },
  { name: "Gesamtbriefing Wagenverantwortliche", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: null, lag: 10 }] },
  { name: "Finales Vortreffen (Zoom)", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: null, lag: 3 }] },
];

const startTodos = (element: string, texts: string[]): PlanTemplateTodo[] =>
  texts.map((text) => ({ element, text, anchor: "start", daysBefore: 0 }));

export const KP27_PLAN_TODOS: PlanTemplateTodo[] = [
  ...startTodos("Rechtliches fertig", [
    "Genehmigung Versammlung / Route",
    "Aufstellungsmap Auftakt / Abschluss",
    "Zeitplan Krachparade mit KVR abgestimmt",
  ]),
  ...startTodos("Sicherheitskonzept fertig", [
    "Sicherheitskonzept und Abschnittsleitungen",
    "Anzahl Ordnerbinden",
    "Anzahl Westen",
    "Funkgeräte",
    "Megaphone",
    "Telegram-Gruppe Abschnittsleitungen",
    "Sanitäter / Awareness",
    "TÜV",
  ]),
  ...startTodos("Programm fertig", [
    "Wagenreihung",
    "Zeitplan Auftakt- / Abschlussprogramm",
    "Reden Politik",
    "Bands / Bühnenacts musikalisch",
    "Bühne",
    "Soundkopplung",
    "MLfM-Wagen",
    "Audiokundgebungen",
    "Moderation",
  ]),
  ...startTodos("Logistik fertig", [
    "Präsentation finales Briefing",
    "Müllkonzept / Mülltonnen (AWM)",
    "Packliste Demozentrale",
    "Demofahrzeug (Auto / Fahrrad)",
    "T-Shirt-Verkauf über die Demozentrale",
    "Spendenkonto, PayPal und Verlinkung",
    "Spendenboxen und Spendenschilder",
    "Verpflegungsstrategie MLfM",
  ]),
  ...startTodos("PR fertig", [
    "SharePics",
    "Pressearbeit / Presseplan inkl. fertiger Pressemitteilung",
    "Podiumsdiskussion (Vorberichterstattung)",
  ]),
  { element: "Briefing Abschnittsleitungen", text: "Checkliste Democharakter", anchor: "start", daysBefore: 1 },
  { element: "Wagenpakete packen", text: "Schilder montieren", anchor: "end", daysBefore: 0 },
];

/** Learnings from KP26, without names; the seed picks the author. */
export const KP27_PLAN_NOTES: PlanTemplateNote[] = [
  { element: "Vortreffen Kollektive", text: "Learning KP26: eine Woche vor dem Anmeldestart." },
  { element: "Anmeldung offen", text: "Learning KP26: Die Anmeldung endet 10 Tage vor der finalen Zusage, damit die Auswahlkommission Zeit hat." },
  { element: "Auswahlkommission", text: "Learning KP26: Die Auswahl braucht Zeit – deshalb 10 Tage eingeplant." },
  { element: "Finale Zusage an Kollektive", text: "Learning KP26: Zusage 80 statt 62 Tage vorher. So lassen sich Soundkopplung und Hauptbühne früher klären." },
  { element: "Soundkopplung · Termin 1", text: "Learning KP26: 2026 gab es drei Termine (4 Wochen, 2 Wochen, 3 Tage vorher). Künftig mindestens drei, der erste so früh wie möglich nach der Zusage." },
  { element: "Pressemitteilung Vorbericht", text: "Learning KP26: Erste Pressemitteilung zwei Monate vorher, danach weitere Termine. Vorberichterstattung stärkt den Kundgebungscharakter." },
  { element: "Wagenpakete packen", text: "Learning KP26: 10–14 Tage vorher packen und mehr Leute einplanen." },
  { element: "Briefing Abschnittsleitungen", text: "Learning KP26: Erst die Abschnittsleitungen briefen, dann die Wagenverantwortlichen." },
  { element: "Gesamtbriefing Wagenverantwortliche", text: "Learning KP26: Mit allen Abschnittsleitungen, 10 Tage vorher." },
  { element: "Finales Vortreffen (Zoom)", text: "Learning KP26: Kurz vorher per Zoom hat sich bewährt." },
];
