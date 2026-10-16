// `pnpm db:seed` targets the dev branch (DATABASE_URL), `pnpm db:seed:prod`
// passes --prod and targets production (DATABASE_URL_PROD). The override has
// to happen before the database module is loaded, so import "./index" only
// dynamically inside seed().
import { parseAdminEmails } from "../lib/access";
import { KP27_PLAN, KP27_PLAN_NOTES, KP27_PLAN_TODOS } from "./kp27-template";

const isProd = process.argv.includes("--prod");
if (isProd) {
  const prodUrl = process.env.DATABASE_URL_PROD;
  if (!prodUrl) {
    throw new Error("DATABASE_URL_PROD fehlt in .env.local.");
  }
  process.env.DATABASE_URL = prodUrl;
}

export const SEED_VERSION = "9";

/** Made-up test members (spec 002), never in production. */
export const TEST_MEMBERS = [
  { email: "kim.brenner@example.org", name: "Kim Brenner", isAdmin: true },
  { email: "alex.rauch@example.org", name: "Alex Rauch", isAdmin: false },
  { email: "sascha.moeller@example.org", name: "Sascha Möller", isAdmin: false },
  // Spec 003
  { email: "robin.tal@example.org", name: "Robin Tal", isAdmin: false },
  { email: "jo.kranz@example.org", name: "Jo Kranz", isAdmin: false },
  { email: "mika.sonnleitner@example.org", name: "Mika Sonnleitner", isAdmin: false },
  { email: "luca.pfeffer@example.org", name: "Luca Pfeffer", isAdmin: false },
  { email: "noa.fink@example.org", name: "Noa Fink", isAdmin: false },
  { email: "ivy.lamm@example.org", name: "Ivy Lamm", isAdmin: false },
];

/** The current edition (spec 003), also in production. */
export const EDITION = { name: "Krachparade 2027", dDay: "2027-05-08" };

/**
 * The 15 departments in display order (spec 003), with the lead from the test
 * members. Production gets the departments without a lead.
 */
export const DEPARTMENTS = [
  { name: "Demoleitung", lead: "kim.brenner@example.org" },
  { name: "Planung Auftakt/Abschlussfläche", lead: "alex.rauch@example.org" },
  { name: "Bühne / Soundkopplung", lead: "sascha.moeller@example.org" },
  { name: "Route", lead: "kim.brenner@example.org" },
  { name: "Wagenreihung", lead: "robin.tal@example.org" },
  { name: "Wagenpakete", lead: "alex.rauch@example.org" },
  { name: "Bühnenprogramm politisch", lead: "jo.kranz@example.org" },
  { name: "Bühnenprogramm musikalisch", lead: "mika.sonnleitner@example.org" },
  { name: "Social Media", lead: "luca.pfeffer@example.org" },
  { name: "Kommunikation E-Mails", lead: "mika.sonnleitner@example.org" },
  { name: "Kollektiv-Chats", lead: "noa.fink@example.org" },
  { name: "Teaser / Aftermovie", lead: "ivy.lamm@example.org" },
  { name: "Pressearbeit", lead: "jo.kranz@example.org" },
  { name: "Finanzen", lead: "noa.fink@example.org" },
  { name: "Ressourcen / Material", lead: "ivy.lamm@example.org" },
];

/**
 * Proposed working groups (spec 005) with their departments by name, also in
 * production. Only created while the current edition has no working group.
 */
export const WORKING_GROUPS = [
  { name: "Demo & Route", departments: ["Demoleitung", "Route", "Wagenreihung"] },
  {
    name: "Flächen & Technik",
    departments: [
      "Planung Auftakt/Abschlussfläche",
      "Bühne / Soundkopplung",
      "Wagenpakete",
      "Ressourcen / Material",
    ],
  },
  { name: "Programm", departments: ["Bühnenprogramm politisch", "Bühnenprogramm musikalisch"] },
  {
    name: "Kommunikation",
    departments: ["Social Media", "Kommunikation E-Mails", "Kollektiv-Chats", "Teaser / Aftermovie", "Pressearbeit"],
  },
  { name: "Finanzen", departments: ["Finanzen"] },
];

/** Memberships of the test members (spec 005), never in production. */
export const TEST_MEMBERSHIPS = [
  { email: "kim.brenner@example.org", groups: ["Demo & Route", "Flächen & Technik"] },
  { email: "alex.rauch@example.org", groups: ["Flächen & Technik"] },
  { email: "sascha.moeller@example.org", groups: ["Programm"] },
  { email: "jo.kranz@example.org", groups: ["Programm", "Kommunikation"] },
  { email: "luca.pfeffer@example.org", groups: ["Kommunikation"] },
  { email: "noa.fink@example.org", groups: ["Finanzen"] },
];

/** Made-up meeting with minutes (spec 004), never in production. */
export const TEST_MEETING = {
  title: "Testtreffen",
  date: "2026-10-14",
  place: "Werkstatt (Beispiel)",
  moderator: "kim.brenner@example.org",
  minuteTaker: "sascha.moeller@example.org",
  attendees: ["kim.brenner@example.org", "alex.rauch@example.org", "sascha.moeller@example.org"],
  guests: "Gast Beispiel",
  // Spec 017
  summary:
    "Die Route bleibt wie im Vorjahr, Start und Ende sind beschlossen. Offen ist noch, wie wir das Geld für die Wagen zusammenbekommen.",
  createdBy: "kim.brenner@example.org",
  items: [
    { topic: "Route", kind: "info", text: "Die Route vom letzten Jahr ist als Vorlage da." },
    { topic: "Route", kind: "entscheidung", text: "Start und Ende bleiben wie im Vorjahr." },
    { topic: "Finanzen", kind: "diskussion", text: "Soli-Party oder Spendenaufruf zuerst?" },
    {
      topic: "Finanzen",
      kind: "todo",
      text: "Angebote für Wagen einholen",
      owner: "alex.rauch@example.org",
      dueDate: "2026-10-01",
      department: "Finanzen",
    },
    { topic: "Presse", kind: "info", text: "Pressemappe vom Vorjahr liegt im Ordner." },
    {
      topic: "Presse",
      kind: "todo",
      text: "Fotos für die Pressemappe sammeln",
      ownerName: "Gast Beispiel",
      dueDate: "2027-03-31",
      department: "Pressearbeit",
    },
  ],
} as const;

/** Plan template element (specs 006, 010); working group and department by name. */
export type PlanTemplateElement = {
  name: string;
  group: string;
  kind: "milestone" | "task";
  durationDays?: number;
  department?: string;
  owner?: string;
  /** Successor by name with lag in days; `null` = the D-Day. */
  next: { to: string | null; lag: number }[];
  fixedDate?: string;
  shiftDays?: number;
  wobbly?: boolean;
};

/**
 * Made-up example plan (spec 006, test layout v4), never in production. Only
 * created while the current edition has no plan element.
 */
export const TEST_PLAN: PlanTemplateElement[] = [
  { name: "Budget KP27 beschlossen", group: "Finanzen", kind: "milestone", department: "Finanzen", owner: "noa.fink@example.org", next: [{ to: "Voranmeldung geöffnet", lag: 12 }] },
  { name: "Voranmeldung geöffnet", group: "Kommunikation", kind: "milestone", department: "Kommunikation E-Mails", owner: "mika.sonnleitner@example.org", next: [{ to: "Vortreffen Kollektive", lag: 20 }] },
  { name: "Vortreffen Kollektive", group: "Kommunikation", kind: "milestone", department: "Kollektiv-Chats", owner: "noa.fink@example.org", next: [{ to: "Anmeldung offen", lag: 7 }] },
  { name: "Anmeldung offen", group: "Kommunikation", kind: "task", durationDays: 21, department: "Kommunikation E-Mails", owner: "mika.sonnleitner@example.org", next: [{ to: "Auswahlkommission", lag: 0 }] },
  { name: "Auswahlkommission", group: "Programm", kind: "task", durationDays: 10, next: [{ to: "Finale Zusage an Kollektive", lag: 0 }] },
  { name: "Finale Zusage an Kollektive", group: "Programm", kind: "milestone", owner: "mika.sonnleitner@example.org", next: [{ to: "Zahlungsfrist Kollektive", lag: 0 }, { to: "Soundkopplung · Termin 1", lag: 7 }] },
  { name: "Zahlungsfrist Kollektive", group: "Finanzen", kind: "task", durationDays: 23, department: "Finanzen", owner: "noa.fink@example.org", next: [{ to: null, lag: 57 }] },
  { name: "Route & Aufstellung ausarbeiten", group: "Demo & Route", kind: "task", durationDays: 28, department: "Route", owner: "kim.brenner@example.org", next: [{ to: "Versammlungsanzeige beim KVR", lag: 0 }] },
  { name: "Versammlungsanzeige beim KVR", group: "Demo & Route", kind: "milestone", department: "Demoleitung", owner: "kim.brenner@example.org", next: [{ to: "Kooperationsgespräch KVR/Polizei", lag: 50 }] },
  { name: "Kooperationsgespräch KVR/Polizei", group: "Demo & Route", kind: "milestone", department: "Demoleitung", owner: "kim.brenner@example.org", next: [{ to: "Finaler Crosscheck", lag: 15 }], fixedDate: "2027-04-08" },
  { name: "Sicherheitskonzept & Abschnittsleitungen", group: "Demo & Route", kind: "task", durationDays: 30, department: "Demoleitung", owner: "alex.rauch@example.org", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Wagenreihung", group: "Programm", kind: "task", durationDays: 14, owner: "robin.tal@example.org", next: [{ to: "Finaler Crosscheck", lag: 0 }] },
  { name: "Finaler Crosscheck", group: "Demo & Route", kind: "milestone", department: "Demoleitung", owner: "kim.brenner@example.org", next: [{ to: "Briefing Abschnittsleitungen", lag: 3 }] },
  { name: "Briefing Abschnittsleitungen", group: "Demo & Route", kind: "milestone", department: "Demoleitung", owner: "kim.brenner@example.org", next: [{ to: "Gesamtbriefing Wagenverantwortliche", lag: 4 }] },
  { name: "Gesamtbriefing Wagenverantwortliche", group: "Demo & Route", kind: "milestone", department: "Demoleitung", owner: "kim.brenner@example.org", next: [{ to: null, lag: 10 }] },
  { name: "Finales Vortreffen (Zoom)", group: "Demo & Route", kind: "milestone", department: "Demoleitung", next: [{ to: null, lag: 3 }] },
  { name: "Shirt-Umfrage aktiv", group: "Flächen & Technik", kind: "task", durationDays: 30, department: "Ressourcen / Material", owner: "ivy.lamm@example.org", next: [{ to: "T-Shirts bestellt", lag: 0 }] },
  { name: "T-Shirts bestellt", group: "Flächen & Technik", kind: "milestone", department: "Ressourcen / Material", owner: "ivy.lamm@example.org", next: [{ to: null, lag: 49 }], wobbly: true },
  { name: "Soundkopplung · Termin 1", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", owner: "sascha.moeller@example.org", next: [{ to: "Soundkopplung · Termin 2", lag: 45 }] },
  { name: "Soundkopplung · Termin 2", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", owner: "sascha.moeller@example.org", next: [{ to: "Soundkopplung · Termin 3", lag: 25 }] },
  { name: "Soundkopplung · Termin 3", group: "Flächen & Technik", kind: "milestone", department: "Bühne / Soundkopplung", owner: "sascha.moeller@example.org", next: [{ to: null, lag: 3 }] },
  { name: "Westen, Binden & Funk zählen", group: "Flächen & Technik", kind: "task", durationDays: 14, department: "Ressourcen / Material", owner: "alex.rauch@example.org", next: [{ to: "Wagenpakete packen", lag: 0 }] },
  { name: "Wagenpakete packen", group: "Flächen & Technik", kind: "task", durationDays: 4, department: "Wagenpakete", owner: "alex.rauch@example.org", next: [{ to: "Gesamtbriefing Wagenverantwortliche", lag: 0 }] },
  { name: "Bands & Reden anfragen", group: "Programm", kind: "task", durationDays: 40, department: "Bühnenprogramm musikalisch", owner: "mika.sonnleitner@example.org", next: [{ to: "Bühnenprogramm final", lag: 0 }] },
  { name: "Bühnenprogramm final", group: "Programm", kind: "milestone", department: "Bühnenprogramm musikalisch", next: [{ to: null, lag: 14 }] },
  { name: "Social-Media-Plan", group: "Kommunikation", kind: "task", durationDays: 20, department: "Social Media", owner: "luca.pfeffer@example.org", next: [{ to: "Pressemitteilung Vorbericht", lag: 0 }], shiftDays: -10 },
  { name: "Pressemitteilung Vorbericht", group: "Kommunikation", kind: "milestone", department: "Pressearbeit", owner: "jo.kranz@example.org", next: [{ to: null, lag: 60 }] },
  { name: "Schildermalen", group: "Kommunikation", kind: "milestone", department: "Social Media", next: [{ to: null, lag: 34 }] },
  { name: "Teaser veröffentlicht", group: "Kommunikation", kind: "milestone", department: "Teaser / Aftermovie", owner: "ivy.lamm@example.org", next: [{ to: null, lag: 21 }], shiftDays: -5 },
  { name: "Spendenkonto & Boxen bereit", group: "Finanzen", kind: "milestone", department: "Finanzen", next: [{ to: null, lag: 17 }] },
];

/** To-do of a plan template, by element name. */
export type PlanTemplateTodo = {
  element: string;
  text: string;
  owner?: string;
  anchor: "start" | "end";
  daysBefore: number;
};

/** Note of a plan template, by element name; without author the seed picks one. */
export type PlanTemplateNote = { element: string; text: string; author?: string };

/** Made-up to-dos of the example plan (spec 006), by element name. */
export const TEST_PLAN_TODOS: PlanTemplateTodo[] = [
  { element: "Finaler Crosscheck", text: "Rechtliches geprüft", owner: "kim.brenner@example.org", anchor: "start", daysBefore: 2 },
  { element: "Finaler Crosscheck", text: "Sicherheitskonzept geprüft", owner: "alex.rauch@example.org", anchor: "start", daysBefore: 2 },
  { element: "Finaler Crosscheck", text: "Programm geprüft", owner: "sascha.moeller@example.org", anchor: "start", daysBefore: 2 },
  { element: "Finaler Crosscheck", text: "Logistik & Material geprüft", owner: "alex.rauch@example.org", anchor: "start", daysBefore: 2 },
  { element: "Finaler Crosscheck", text: "PR geprüft", owner: "jo.kranz@example.org", anchor: "start", daysBefore: 2 },
  { element: "Finaler Crosscheck", text: "Ergebnis ins Plenum", owner: "kim.brenner@example.org", anchor: "end", daysBefore: 0 },
  { element: "Auswahlkommission", text: "Auswahlkriterien beschlossen", anchor: "start", daysBefore: 14 },
  { element: "Wagenpakete packen", text: "Mehr Helfende eingeteilt", anchor: "start", daysBefore: 7 },
  { element: "Pressemitteilung Vorbericht", text: "Presseverteiler aktualisiert", anchor: "start", daysBefore: 14 },
];

/** Made-up notes of the example plan (spec 006), by element name. */
export const TEST_PLAN_NOTES: PlanTemplateNote[] = [
  { element: "Finaler Crosscheck", author: "kim.brenner@example.org", text: "Wir gehen die Liste gemeinsam im Plenum durch." },
  { element: "Finaler Crosscheck", author: "alex.rauch@example.org", text: "Material-Liste vom Vorjahr als Vorlage nehmen." },
  { element: "T-Shirts bestellt", author: "ivy.lamm@example.org", text: "Größen-Umfrage läuft noch, Rücklauf bisher gering." },
];

/**
 * Made-up "Laufende Aufgaben" (spec 018) of two departments of AK Demo &
 * Route, never in production. Only created where the department has none.
 */
export const TEST_ONGOING = [
  {
    department: "Route",
    todos: [
      { text: "Alte Routenskizzen sichten", owner: "kim.brenner@example.org", done: false },
      { text: "Ideen für Zwischenkundgebungen sammeln", done: false },
      { text: "Stadtplan für die Skizzen besorgen", done: true },
    ],
    note: { author: "kim.brenner@example.org", text: "Skizzen vom letzten Jahr liegen im Orga-Ordner (Beispiel)." },
  },
  {
    department: "Wagenreihung",
    todos: [
      { text: "Liste der Wagen vom Vorjahr abgleichen", owner: "kim.brenner@example.org", done: false },
      { text: "Reihenfolge-Wünsche einsammeln", done: false },
      { text: "Vorlage für die Reihung anlegen", done: true },
    ],
    note: { author: "kim.brenner@example.org", text: "Laute Wagen nicht direkt hintereinander einplanen." },
  },
];

/** Made-up notes of AK Demo & Route (spec 018), never in production; only while it has none. */
export const TEST_GROUP_NOTES = [
  { group: "Demo & Route", author: "kim.brenner@example.org", text: "Nächstes AK-Treffen nach dem Plenum, Raum wie immer." },
  { group: "Demo & Route", author: "robin.tal@example.org", text: "Bitte Ideen für die Route bis Monatsende hier sammeln." },
];

/**
 * Made-up feedback (spec 014), never in production. Created once each,
 * recognised by text; the context is an element of `TEST_PLAN`.
 */
export const TEST_FEEDBACK = [
  {
    kind: "bug",
    message: "Nach dem Abhaken springt die Liste kurz nach oben.",
    pagePath: "/meine",
    pageTitle: "Meine Aufgaben – Krachparade Orga",
    context: null,
    device: "iPhone · Safari",
    viewport: "390 × 844",
    status: "new",
    reply: null,
    createdBy: "alex.rauch@example.org",
    updatedBy: null,
  },
  {
    kind: "wish",
    message: "Bitte im Detail-Panel auch die Nachfolger anklickbar machen.",
    pagePath: "/",
    pageTitle: "Plan – Krachparade Orga",
    context: "Finaler Crosscheck",
    device: "Mac · Firefox",
    viewport: "1440 × 900",
    status: "done",
    reply: "Ist umgesetzt, danke!",
    createdBy: "alex.rauch@example.org",
    updatedBy: "kim.brenner@example.org",
  },
] as const;

/**
 * Idempotent: a second run changes nothing. With `prod` only master data is
 * written, never test people (from spec 002 on, always with @example.org).
 */
export async function seed({ prod }: { prod: boolean }) {
  const { db } = await import("./index");
  const { asc, eq } = await import("drizzle-orm");
  const { and } = await import("drizzle-orm");
  const { inArray, isNull, or } = await import("drizzle-orm");
  const { appMeta, departments, editions, meetingAttendees, meetingItems, meetings, members } =
    await import("./schema");
  const { workingGroupMembers, workingGroups } = await import("./schema");

  await db
    .insert(appMeta)
    .values({ key: "seed_version", value: SEED_VERSION })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: SEED_VERSION } });
  console.log(`app_meta: seed_version = ${SEED_VERSION}`);

  if (!prod) {
    for (const member of TEST_MEMBERS) {
      await db
        .insert(members)
        .values({ ...member, active: true })
        .onConflictDoUpdate({
          target: members.email,
          set: { name: member.name, isAdmin: member.isAdmin, active: true },
        });
    }
    console.log(`members: ${TEST_MEMBERS.length} Test-Mitglieder`);
  }

  // Existing editions and departments are never overwritten: the D-Day,
  // names and leads may have been changed in the app since.
  await db
    .insert(editions)
    .values({ ...EDITION, isCurrent: true })
    .onConflictDoNothing({ target: editions.name });
  const [edition] = await db.select().from(editions).where(eq(editions.name, EDITION.name));
  console.log(`editions: ${edition.name} (D-Day ${edition.dDay})`);

  const memberIds = new Map<string, string>();
  if (!prod) {
    for (const member of await db.select({ id: members.id, email: members.email }).from(members)) {
      memberIds.set(member.email, member.id);
    }
  }
  const inserted = await db
    .insert(departments)
    .values(
      DEPARTMENTS.map((department, index) => ({
        editionId: edition.id,
        name: department.name,
        sortOrder: index + 1,
        leadId: memberIds.get(department.lead) ?? null,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: departments.id });
  console.log(`departments: ${inserted.length} neu, ${DEPARTMENTS.length - inserted.length} schon vorhanden`);

  await seedWorkingGroups();

  if (!prod) {
    const [existing] = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(eq(meetings.editionId, edition.id), eq(meetings.title, TEST_MEETING.title)))
      .limit(1);
    if (existing) {
      // Spec 017: only fills an empty summary, never overwrites one.
      const filled = await db
        .update(meetings)
        .set({ summary: TEST_MEETING.summary })
        .where(and(eq(meetings.id, existing.id), or(isNull(meetings.summary), eq(meetings.summary, ""))))
        .returning({ id: meetings.id });
      console.log(
        `meetings: ${TEST_MEETING.title} schon vorhanden${filled.length > 0 ? ", Kurzfassung ergänzt" : ""}`
      );
    } else {
      const memberId = (email: string) => {
        const id = memberIds.get(email);
        if (!id) throw new Error(`Test-Mitglied fehlt: ${email}`);
        return id;
      };
      const departmentIds = new Map(
        (
          await db
            .select({ id: departments.id, name: departments.name })
            .from(departments)
            .where(eq(departments.editionId, edition.id))
        ).map((department) => [department.name, department.id])
      );
      const [meeting] = await db
        .insert(meetings)
        .values({
          editionId: edition.id,
          date: TEST_MEETING.date,
          title: TEST_MEETING.title,
          place: TEST_MEETING.place,
          moderatorId: memberId(TEST_MEETING.moderator),
          minuteTakerId: memberId(TEST_MEETING.minuteTaker),
          guests: TEST_MEETING.guests,
          summary: TEST_MEETING.summary,
          createdBy: memberId(TEST_MEETING.createdBy),
        })
        .returning({ id: meetings.id });
      await db
        .insert(meetingAttendees)
        .values(TEST_MEETING.attendees.map((email) => ({ meetingId: meeting.id, memberId: memberId(email) })));
      await db.insert(meetingItems).values(
        TEST_MEETING.items.map((item, index) => ({
          meetingId: meeting.id,
          topic: item.topic,
          kind: item.kind,
          text: item.text,
          ownerId: "owner" in item ? memberId(item.owner) : null,
          ownerName: "ownerName" in item ? item.ownerName : null,
          dueDate: "dueDate" in item ? item.dueDate : null,
          departmentId: "department" in item ? (departmentIds.get(item.department) ?? null) : null,
          sortOrder: index + 1,
          createdBy: memberId(TEST_MEETING.createdBy),
        }))
      );
      console.log(`meetings: ${TEST_MEETING.title} mit ${TEST_MEETING.items.length} Punkten angelegt`);
    }

    await seedTestPlan();
    // After the plan: seedPlan only runs while the edition has no element at all.
    await seedTestOngoing();
    await seedTestFeedback();
  } else {
    await seedKp27Template();
  }

  /**
   * Spec 006, never in production: the example plan, only while the current
   * edition has no plan element.
   */
  async function seedTestPlan() {
    const result = await seedPlan(
      { elements: TEST_PLAN, todos: TEST_PLAN_TODOS, notes: TEST_PLAN_NOTES },
      {
        createdBy: memberIds.get("kim.brenner@example.org") ?? null,
        noteAuthorId: (note) => (note.author ? memberIds.get(note.author) : undefined),
      }
    );
    if (result === "no_edition") {
      console.log("plan_elements: keine aktuelle Ausgabe");
    } else if (result === "exists") {
      console.log("plan_elements: schon vorhanden, nichts geändert");
    } else {
      console.log(
        `plan_elements: ${result.elements} angelegt, ${result.links} Verbindungen, ${result.todos} To-dos, ${result.notes} Notizen`
      );
    }
  }

  /**
   * Spec 018, never in production: "Laufende Aufgaben" of the test
   * departments (only where there is none yet) and notes of the test working
   * group (only while it has none).
   */
  async function seedTestOngoing() {
    const { planElements, planNotes, planTodos, workingGroupNotes } = await import("./schema");
    const { count, sql } = await import("drizzle-orm");
    const [current] = await db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1);
    if (!current) {
      console.log("Laufende Aufgaben: keine aktuelle Ausgabe");
      return;
    }
    const authorId = (email: string) => {
      const id = memberIds.get(email);
      if (!id) throw new Error(`Test-Mitglied fehlt: ${email}`);
      return id;
    };

    let created = 0;
    for (const entry of TEST_ONGOING) {
      const [department] = await db
        .select({ id: departments.id, workingGroupId: departments.workingGroupId })
        .from(departments)
        .where(and(eq(departments.editionId, current.id), eq(departments.name, entry.department)))
        .limit(1);
      if (!department?.workingGroupId) continue;
      const [element] = await db
        .insert(planElements)
        .values({
          editionId: current.id,
          workingGroupId: department.workingGroupId,
          departmentId: department.id,
          kind: "milestone",
          name: "Laufende Aufgaben",
          durationDays: 0,
          isOngoing: true,
          sortOrder: 0,
          createdBy: authorId("kim.brenner@example.org"),
        })
        .onConflictDoNothing({
          target: [planElements.editionId, planElements.departmentId],
          where: sql`${planElements.isOngoing} = true`,
        })
        .returning({ id: planElements.id });
      if (!element) continue;
      const now = new Date();
      await db.insert(planTodos).values(
        entry.todos.map((todo, index) => ({
          elementId: element.id,
          text: todo.text,
          ownerId: "owner" in todo && todo.owner ? authorId(todo.owner) : null,
          done: todo.done,
          doneAt: todo.done ? now : null,
          sortOrder: index + 1,
          createdBy: authorId("kim.brenner@example.org"),
        }))
      );
      await db.insert(planNotes).values({ elementId: element.id, authorId: authorId(entry.note.author), text: entry.note.text });
      created += 1;
    }
    console.log(`Laufende Aufgaben: ${created} angelegt, ${TEST_ONGOING.length - created} schon vorhanden oder ohne AK`);

    let notes = 0;
    for (const groupName of [...new Set(TEST_GROUP_NOTES.map((note) => note.group))]) {
      const [group] = await db
        .select({ id: workingGroups.id })
        .from(workingGroups)
        .where(and(eq(workingGroups.editionId, current.id), eq(workingGroups.name, groupName)))
        .limit(1);
      if (!group) continue;
      const [{ total }] = await db
        .select({ total: count() })
        .from(workingGroupNotes)
        .where(eq(workingGroupNotes.workingGroupId, group.id));
      if (total > 0) continue;
      const entries = TEST_GROUP_NOTES.filter((note) => note.group === groupName);
      // One after the other, so the order of `created_at` is the order of the list.
      for (const note of entries) {
        await db.insert(workingGroupNotes).values({ workingGroupId: group.id, authorId: authorId(note.author), text: note.text });
      }
      notes += entries.length;
    }
    console.log(`working_group_notes: ${notes} angelegt`);
  }

  /**
   * Spec 014, never in production: removes feedback left by the click tests
   * ("E2E …") and creates the example feedback unless its text exists.
   */
  async function seedTestFeedback() {
    const { feedback } = await import("./schema");
    const { like } = await import("drizzle-orm");
    const removed = await db
      .delete(feedback)
      .where(like(feedback.message, "E2E %"))
      .returning({ id: feedback.id });
    let created = 0;
    for (const entry of TEST_FEEDBACK) {
      const [existing] = await db
        .select({ id: feedback.id })
        .from(feedback)
        .where(eq(feedback.message, entry.message))
        .limit(1);
      if (existing) continue;
      await db.insert(feedback).values({
        ...entry,
        createdBy: memberIds.get(entry.createdBy) ?? null,
        updatedBy: entry.updatedBy ? (memberIds.get(entry.updatedBy) ?? null) : null,
      });
      created += 1;
    }
    console.log(
      `feedback: ${removed.length} E2E-Meldungen entfernt, ${created} angelegt, ${TEST_FEEDBACK.length - created} schon vorhanden`
    );
  }

  /**
   * Spec 010, only in production: the KP27 template, only while the current
   * edition has no plan element. The notes are written by the earliest created
   * active member listed in `ADMIN_EMAILS`. The output never shows addresses.
   */
  async function seedKp27Template() {
    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
    const [author] = adminEmails.length
      ? await db
          .select({ id: members.id })
          .from(members)
          .where(and(eq(members.active, true), inArray(members.email, adminEmails)))
          .orderBy(asc(members.createdAt))
          .limit(1)
      : [];
    const result = await seedPlan(
      { elements: KP27_PLAN, todos: KP27_PLAN_TODOS, notes: author ? KP27_PLAN_NOTES : [] },
      { createdBy: null, noteAuthorId: () => author?.id, changeSummary: "Angelegt (KP27-Vorlage)" }
    );
    if (result === "no_edition") {
      console.log("KP27-Vorlage: keine aktuelle Ausgabe");
    } else if (result === "exists") {
      console.log("KP27-Vorlage übersprungen (Plan existiert schon)");
    } else {
      console.log(
        `KP27-Vorlage: ${result.elements} Elemente, ${result.links} Verbindungen, ${result.todos} To-dos, ${result.notes} Notizen`
      );
      if (!author) console.log("Notizen übersprungen (kein Admin-Mitglied)");
    }
  }

  /**
   * Creates a plan template (specs 006, 010) in the current edition, only while
   * it has no plan element. Working groups and departments by name, a missing
   * name leaves the field empty. With `changeSummary` every element gets an
   * entry in `plan_changes` without member.
   */
  async function seedPlan(
    template: { elements: PlanTemplateElement[]; todos: PlanTemplateTodo[]; notes: PlanTemplateNote[] },
    options: {
      createdBy: string | null;
      noteAuthorId: (note: PlanTemplateNote) => string | undefined;
      changeSummary?: string;
    }
  ) {
    const { planChanges, planElements, planLinks, planNotes, planTodos } = await import("./schema");
    const [current] = await db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1);
    if (!current) return "no_edition" as const;
    const [existingElement] = await db
      .select({ id: planElements.id })
      .from(planElements)
      .where(eq(planElements.editionId, current.id))
      .limit(1);
    if (existingElement) return "exists" as const;

    const groupIds = new Map(
      (
        await db
          .select({ id: workingGroups.id, name: workingGroups.name })
          .from(workingGroups)
          .where(eq(workingGroups.editionId, current.id))
      ).map((group) => [group.name, group.id])
    );
    const departmentIds = new Map(
      (
        await db
          .select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(eq(departments.editionId, current.id))
      ).map((department) => [department.name, department.id])
    );
    const { createdBy } = options;

    const created = await db
      .insert(planElements)
      .values(
        template.elements.map((element, index) => ({
          editionId: current.id,
          workingGroupId: groupIds.get(element.group) ?? null,
          departmentId: element.department ? (departmentIds.get(element.department) ?? null) : null,
          ownerId: element.owner ? (memberIds.get(element.owner) ?? null) : null,
          kind: element.kind,
          name: element.name,
          durationDays: element.durationDays ?? 0,
          shiftDays: element.shiftDays ?? 0,
          fixedDate: element.fixedDate ?? null,
          wobbly: element.wobbly ?? false,
          sortOrder: index + 1,
          createdBy,
          updatedBy: createdBy,
        }))
      )
      .returning({ id: planElements.id, name: planElements.name });
    const elementIds = new Map(created.map((element) => [element.name, element.id]));
    const elementId = (name: string) => {
      const id = elementIds.get(name);
      if (!id) throw new Error(`Plan-Element fehlt: ${name}`);
      return id;
    };

    const links = template.elements.flatMap((element) =>
      element.next.map((link) => ({
        editionId: current.id,
        fromElementId: elementId(element.name),
        toElementId: link.to === null ? null : elementId(link.to),
        lagDays: link.lag,
      }))
    );
    await db.insert(planLinks).values(links);

    if (template.todos.length > 0) {
      await db.insert(planTodos).values(
        template.todos.map((todo, index) => ({
          elementId: elementId(todo.element),
          text: todo.text,
          ownerId: todo.owner ? (memberIds.get(todo.owner) ?? null) : null,
          anchor: todo.anchor,
          daysBefore: todo.daysBefore,
          sortOrder: index + 1,
          createdBy,
        }))
      );
    }

    const notes = template.notes.flatMap((note) => {
      const authorId = options.noteAuthorId(note);
      return authorId ? [{ elementId: elementId(note.element), authorId, text: note.text }] : [];
    });
    if (notes.length > 0) {
      await db.insert(planNotes).values(notes);
    }

    const { changeSummary } = options;
    if (changeSummary) {
      await db
        .insert(planChanges)
        .values(created.map((element) => ({ elementId: element.id, memberId: null, summary: changeSummary })));
    }

    return { elements: created.length, links: links.length, todos: template.todos.length, notes: notes.length };
  }

  /**
   * Spec 005, also in production: the proposed working groups, only while the
   * current edition has none. Only departments without a working group are
   * assigned, existing assignments are never overwritten. Test memberships
   * only without `prod`; `working_groups_final` stays untouched.
   */
  async function seedWorkingGroups() {
    const [current] = await db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1);
    if (!current) {
      console.log("working_groups: keine aktuelle Ausgabe");
      return;
    }
    const [existingGroup] = await db
      .select({ id: workingGroups.id })
      .from(workingGroups)
      .where(eq(workingGroups.editionId, current.id))
      .limit(1);
    if (existingGroup) {
      console.log("working_groups: schon vorhanden, nichts geändert");
    } else {
      let assigned = 0;
      for (const [index, group] of WORKING_GROUPS.entries()) {
        const [created] = await db
          .insert(workingGroups)
          .values({ editionId: current.id, name: group.name, sortOrder: index + 1 })
          .returning({ id: workingGroups.id });
        const updated = await db
          .update(departments)
          .set({ workingGroupId: created.id })
          .where(
            and(
              eq(departments.editionId, current.id),
              inArray(departments.name, group.departments),
              isNull(departments.workingGroupId)
            )
          )
          .returning({ id: departments.id });
        assigned += updated.length;
      }
      console.log(`working_groups: ${WORKING_GROUPS.length} angelegt, ${assigned} Aufgabenbereiche zugeordnet`);
    }

    if (prod) return;
    const groupIds = new Map(
      (
        await db
          .select({ id: workingGroups.id, name: workingGroups.name })
          .from(workingGroups)
          .where(eq(workingGroups.editionId, current.id))
      ).map((group) => [group.name, group.id])
    );
    const rows = TEST_MEMBERSHIPS.flatMap((membership) => {
      const memberId = memberIds.get(membership.email);
      return membership.groups.flatMap((name) => {
        const workingGroupId = groupIds.get(name);
        return memberId && workingGroupId ? [{ workingGroupId, memberId }] : [];
      });
    });
    const inserted = rows.length
      ? await db.insert(workingGroupMembers).values(rows).onConflictDoNothing().returning()
      : [];
    console.log(`working_group_members: ${inserted.length} neu, ${rows.length - inserted.length} schon vorhanden`);
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed({ prod: isProd }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
