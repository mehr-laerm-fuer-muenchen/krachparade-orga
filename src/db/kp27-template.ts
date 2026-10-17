// KP27 template (spec 010): the processes from the KP26 sheet with the changes
// decided on 14.10.2026; placements and links as in test layout v5 (spec 026).
// Data only, no database access; created by the seed with --prod while the
// current edition has no plan element. No people.
import type { PlanTemplateElement, PlanTemplateNote, PlanTemplateTodo } from "./seed";

export const KP27_PLAN: PlanTemplateElement[] = [
  { name: "Voranmeldung geöffnet", group: "Kommunikation", kind: "milestone", department: "Kommunikation E-Mails", next: [{ to: "Vortreffen Kollektive", lag: 20 }] },
  { name: "Vortreffen Kollektive", group: "Kommunikation", kind: "milestone", department: "Kollektiv-Chats", next: [{ to: "Anmeldung offen", lag: 7 }] },
  { name: "Anmeldung offen", group: "Kommunikation", kind: "task", durationDays: 21, department: "Kommunikation E-Mails", next: [{ to: "Auswahlkommission", lag: 0 }] },
  { name: "Auswahlkommission", group: "Demo & Route", kind: "task", durationDays: 10, department: "Demoleitung", next: [{ to: "Finale Zusage an Kollektive", lag: 0 }] },
  { name: "Finale Zusage an Kollektive", group: "Demo & Route", kind: "milestone", department: "Demoleitung", fixedOffsetDays: 80, next: [{ to: "Zahlungsfrist Kollektive", lag: 0 }, { to: "Soundkopplung · Termin 1", lag: 7 }, { to: "Wagenreihung steht", lag: 0 }] },
  { name: "Zahlungsfrist Kollektive", group: "Finanzen", kind: "task", durationDays: 30, department: "Finanzen", placement: "asap", next: [{ to: null, lag: 0 }] },
  { name: "Soundkopplung · Termin 1", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", placement: "asap", next: [{ to: "Soundkopplung · Termin 2", lag: 0 }] },
  { name: "Soundkopplung · Termin 2", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", placement: "free", freeStartDay: -28, next: [{ to: "Soundkopplung · Termin 3", lag: 0 }] },
  { name: "Soundkopplung · Termin 3", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", fixedOffsetDays: 3, next: [{ to: null, lag: 0 }] },
  { name: "Pressemitteilung Vorbericht", group: "Kommunikation", kind: "milestone", department: "Pressearbeit", fixedOffsetDays: 60, next: [{ to: "PR fertig", lag: 0 }] },
  { name: "T-Shirt-Bestellung", group: "Flächen & Technik", kind: "milestone", department: "Ressourcen / Material", placement: "free", freeStartDay: -49, next: [{ to: "Wagenpakete packen", lag: 21 }] },
  { name: "Schildermalen", group: "Kommunikation", kind: "milestone", department: "Social Media", placement: "free", freeStartDay: -34, next: [{ to: null, lag: 0 }] },
  { name: "Finaler Planungscheck", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Finaler Crosscheck", lag: 7 }] },
  { name: "Rechtliches fertig", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Sicherheitskonzept fertig", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Wagenreihung steht", group: "Programm", kind: "milestone", next: [{ to: "Wagenpakete packen", lag: 0 }, { to: "Programm fertig", lag: 0 }] },
  { name: "Programm fertig", group: "Programm", kind: "milestone", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Logistik fertig", group: "Flächen & Technik", kind: "milestone", department: "Ressourcen / Material", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "PR fertig", group: "Kommunikation", kind: "milestone", department: "Pressearbeit", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Finaler Crosscheck", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: "Briefing Abschnittsleitungen", lag: 3 }] },
  { name: "Briefing Abschnittsleitungen", group: "Demo & Route", kind: "milestone", department: "Demoleitung", fixedOffsetDays: 14, next: [{ to: "Gesamtbriefing Wagenverantwortliche", lag: 4 }] },
  { name: "Wagenpakete packen", group: "Flächen & Technik", kind: "task", durationDays: 4, department: "Wagenpakete", next: [{ to: "Gesamtbriefing Wagenverantwortliche", lag: 0 }] },
  { name: "Gesamtbriefing Wagenverantwortliche", group: "Demo & Route", kind: "milestone", department: "Demoleitung", fixedOffsetDays: 10, next: [{ to: null, lag: 0 }] },
  { name: "Finales Vortreffen (Zoom)", group: "Demo & Route", kind: "milestone", department: "Demoleitung", fixedOffsetDays: 3, next: [{ to: null, lag: 0 }] },
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
  { element: "Zahlungsfrist Kollektive", text: "Selbst gewählte Frist: 30 Tage nach der Zusage, irgendwann vor der Krachparade. „So früh wie möglich“ heißt: Sie startet mit der Zusage und wandert mit, wenn die Zusage sich verschiebt." },
  { element: "Soundkopplung · Termin 2", text: "Nur die Reihenfolge zählt: nach Termin 1, vor Termin 3. Wie viele Tage dazwischen liegen, ist egal. Leg ihn im Fenster dorthin, wo er passt." },
  { element: "Schildermalen", text: "Keine Abhängigkeit – muss nur irgendwann vor der Krachparade passieren. Deshalb ein großes Fenster, und ihr legt den Tag selbst." },
  { element: "Wagenpakete packen", text: "Geht erst, wenn die T-Shirts da sind und die Wagenreihung steht." },
  { element: "Wagenreihung steht", text: "Neu als eigenes Element (bisher To-do bei „Programm fertig“), weil die Wagenpakete davon abhängen." },
];
