import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { check, date, index, integer, jsonb, primaryKey, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { pgView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ShirtOrder } from "../lib/collectives/options";

/** Key/value pairs about the app itself, e.g. `seed_version` (spec 001). */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** People of the core team who may sign in (spec 002). `email` is lower case. */
export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export type Member = typeof members.$inferSelect;

/** One Krachparade per year (spec 003). Exactly one edition is current. */
export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    dDay: date("d_day", { mode: "string" }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    /** False while the working groups are only a proposal (spec 005). */
    workingGroupsFinal: boolean("working_groups_final").notNull().default(false),
    /** Spec 031: window of the public registration form; both empty = closed. */
    registrationOpensOn: date("registration_opens_on", { mode: "string" }),
    registrationClosesOn: date("registration_closes_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("editions_one_current").on(table.isCurrent).where(sql`${table.isCurrent}`)]
);

export type Edition = typeof editions.$inferSelect;

/**
 * Working groups ("AK ‹name›" in the UI) of an edition (spec 005). `name` is
 * stored without the "AK" prefix and is unique per edition ignoring case.
 */
export const workingGroups = pgTable(
  "working_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdBy: uuid("created_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("working_groups_edition_name").on(table.editionId, sql`lower(${table.name})`)]
);

export type WorkingGroup = typeof workingGroups.$inferSelect;

/** Free notes of a working group as a history (spec 018); only the author changes them. */
export const workingGroupNotes = pgTable(
  "working_group_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workingGroupId: uuid("working_group_id")
      .notNull()
      .references(() => workingGroups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("working_group_notes_text", sql`char_length(${table.text}) between 1 and 2000`),
    index("working_group_notes_group").on(table.workingGroupId),
  ]
);

/** Who takes part in which working group (spec 005); one person may be in several. */
export const workingGroupMembers = pgTable(
  "working_group_members",
  {
    workingGroupId: uuid("working_group_id")
      .notNull()
      .references(() => workingGroups.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workingGroupId, table.memberId] })]
);

/**
 * Departments of an edition (spec 003, "Aufgabenbereiche" in the UI from spec
 * 005 on), each in at most one working group. `lead_id` is no longer shown.
 */
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    name: text("name").notNull(),
    leadId: uuid("lead_id").references(() => members.id),
    workingGroupId: uuid("working_group_id").references(() => workingGroups.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("departments_edition_name").on(table.editionId, table.name)]
);

export type Department = typeof departments.$inferSelect;

/**
 * Milestones (no duration) and tasks (duration in calendar days) of the Gantt
 * plan (spec 006). Everything is stored relative to the D-Day except
 * `fixed_date`. Since spec 025 `placement` decides where an element lies.
 */
export const planElements = pgTable(
  "plan_elements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    /** Empty = lane "Ohne AK". */
    workingGroupId: uuid("working_group_id").references(() => workingGroups.id, { onDelete: "set null" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => members.id),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    durationDays: integer("duration_days").notNull().default(0),
    /**
     * Shift against the latest date (spec 006). Not read any more since spec
     * 025; every change of `placement` sets it to 0.
     */
    shiftDays: integer("shift_days").notNull().default(0),
    /** Spec 025: where the element lies in its window ("fixed", "asap", "alap", "free"). */
    placement: text("placement").notNull().default("alap"),
    /** `placement` "fixed", variant "N days before the D-Day" (start of a task). */
    fixedOffsetDays: integer("fixed_offset_days"),
    /** `placement` "fixed", variant "fixed date" (start of a task). */
    fixedDate: date("fixed_date", { mode: "string" }),
    /** `placement` "free": start relative to the D-Day. */
    freeStartDay: integer("free_start_day"),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    /** "Wackelt" as a manual assessment. */
    wobbly: boolean("wobbly").notNull().default(false),
    /**
     * "Laufende Aufgaben" of a department (spec 018): to-dos and notes without
     * a date, hidden in the plan (filtered out before the engine computes).
     */
    isOngoing: boolean("is_ongoing").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    createdBy: uuid("created_by").references(() => members.id),
    updatedBy: uuid("updated_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("plan_elements_kind", sql`${table.kind} in ('milestone', 'task')`),
    check("plan_elements_name", sql`char_length(${table.name}) between 1 and 120`),
    check(
      "plan_elements_duration",
      sql`(${table.kind} = 'milestone' and ${table.durationDays} = 0) or (${table.kind} = 'task' and ${table.durationDays} between 1 and 365)`
    ),
    // Spec 025: no rule across columns here (db:push would fail before the
    // data takeover); Zod and the actions keep the combinations valid.
    check("plan_elements_placement", sql`${table.placement} in ('fixed', 'asap', 'alap', 'free')`),
    check("plan_elements_fixed_offset", sql`${table.fixedOffsetDays} between 0 and 365`),
    check("plan_elements_free_start", sql`${table.freeStartDay} between -730 and 0`),
    index("plan_elements_edition").on(table.editionId, table.sortOrder),
    uniqueIndex("plan_elements_ongoing_department")
      .on(table.editionId, table.departmentId)
      .where(sql`${table.isOngoing} = true`),
  ]
);

export type PlanElement = typeof planElements.$inferSelect;

/** End → start links of the plan (spec 006); empty `to_element_id` = the D-Day. */
export const planLinks = pgTable(
  "plan_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    fromElementId: uuid("from_element_id")
      .notNull()
      .references(() => planElements.id, { onDelete: "cascade" }),
    toElementId: uuid("to_element_id").references(() => planElements.id, { onDelete: "cascade" }),
    lagDays: integer("lag_days").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("plan_links_lag", sql`${table.lagDays} between 0 and 365`),
    check("plan_links_not_self", sql`${table.fromElementId} <> ${table.toElementId}`),
    uniqueIndex("plan_links_from_to")
      .on(table.fromElementId, table.toElementId)
      .where(sql`${table.toElementId} is not null`),
    uniqueIndex("plan_links_from_dday").on(table.fromElementId).where(sql`${table.toElementId} is null`),
  ]
);

export type PlanLink = typeof planLinks.$inferSelect;

/** To-dos of a plan element, due `days_before` its start or end (spec 006). */
export const planTodos = pgTable(
  "plan_todos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    elementId: uuid("element_id")
      .notNull()
      .references(() => planElements.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    ownerId: uuid("owner_id").references(() => members.id),
    anchor: text("anchor").notNull().default("start"),
    daysBefore: integer("days_before").notNull().default(0),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull(),
    createdBy: uuid("created_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("plan_todos_text", sql`char_length(${table.text}) between 1 and 200`),
    check("plan_todos_anchor", sql`${table.anchor} in ('start', 'end')`),
    check("plan_todos_days_before", sql`${table.daysBefore} between 0 and 365`),
    index("plan_todos_element").on(table.elementId, table.sortOrder),
  ]
);

export type PlanTodo = typeof planTodos.$inferSelect;

/** Notes on a plan element (spec 006). */
export const planNotes = pgTable(
  "plan_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    elementId: uuid("element_id")
      .notNull()
      .references(() => planElements.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("plan_notes_text", sql`char_length(${table.text}) between 1 and 2000`),
    index("plan_notes_element").on(table.elementId),
  ]
);

/** Change history of a plan element (spec 006, written from spec 008 on). */
export const planChanges = pgTable(
  "plan_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    elementId: uuid("element_id")
      .notNull()
      .references(() => planElements.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("plan_changes_summary", sql`char_length(${table.summary}) between 1 and 300`),
    index("plan_changes_element").on(table.elementId),
  ]
);

/** One core team meeting with its minutes (spec 004). */
export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    date: date("date", { mode: "string" }).notNull(),
    title: text("title").notNull().default("Orga-Treffen"),
    place: text("place").notNull().default(""),
    moderatorId: uuid("moderator_id").references(() => members.id),
    minuteTakerId: uuid("minute_taker_id").references(() => members.id),
    /** Guests without an account, free text. */
    guests: text("guests").notNull().default(""),
    /** Pasted note or transcript. */
    rawNotes: text("raw_notes").notNull().default(""),
    /** A few sentences written by hand, shown on top of the read view (spec 017). */
    summary: text("summary"),
    status: text("status").notNull().default("entwurf"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("meetings_status", sql`${table.status} in ('entwurf', 'final')`),
    index("meetings_edition_date").on(table.editionId, table.date),
  ]
);

export type Meeting = typeof meetings.$inferSelect;

/** Members present at a meeting (spec 004). */
export const meetingAttendees = pgTable(
  "meeting_attendees",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]
);

/**
 * One point of the minutes (spec 004). A TOP (agenda item) is no row of its
 * own: it exists as long as at least one item carries its `topic`.
 */
export const meetingItems = pgTable(
  "meeting_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    /** To-dos only: a member or (`ownerName`) a person without an account. */
    ownerId: uuid("owner_id").references(() => members.id),
    ownerName: text("owner_name"),
    dueDate: date("due_date", { mode: "string" }),
    departmentId: uuid("department_id").references(() => departments.id),
    /** Link to the plan (spec 006, set from R2 on). */
    planElementId: uuid("plan_element_id").references(() => planElements.id, { onDelete: "set null" }),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("meeting_items_kind", sql`${table.kind} in ('info', 'diskussion', 'entscheidung', 'todo')`),
    check("meeting_items_owner_one", sql`${table.ownerId} is null or ${table.ownerName} is null`),
    index("meeting_items_meeting").on(table.meetingId, table.sortOrder),
  ]
);

export type MeetingItem = typeof meetingItems.$inferSelect;

/**
 * Spec 014: bug report or wish from the bug button in the header. Page,
 * device and the open plan element are captured in the browser. Only admins
 * change `status` and `reply`; entries are never deleted.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    pagePath: text("page_path").notNull(),
    pageTitle: text("page_title"),
    /** Title of the plan element open in the detail panel, if any. */
    context: text("context"),
    device: text("device"),
    viewport: text("viewport"),
    status: text("status").notNull().default("new"),
    reply: text("reply"),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "set null" }),
    /** Who last changed status or reply. */
    updatedBy: uuid("updated_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("feedback_kind", sql`${table.kind} in ('bug', 'wish')`),
    check("feedback_status", sql`${table.status} in ('new', 'in_progress', 'done', 'rejected')`),
    index("feedback_created").on(table.createdAt),
  ]
);

export type Feedback = typeof feedback.$inferSelect;

/**
 * Spec 030: columns of the day plan of the Krachparade ("Programm & Bühne",
 * …), in the order of `position`. Times of the day plan are minutes since
 * 0:00 of the edition's D-Day, so there is no date and no time zone.
 */
export const dayTracks = pgTable(
  "day_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("day_tracks_name", sql`char_length(${table.name}) between 1 and 40`)]
);

export type DayTrack = typeof dayTracks.$inferSelect;

/**
 * Spec 030: one entry of the day plan. Without `start_minute` it has no time,
 * without `end_minute` it is a point in time. The person is a member or
 * (`person_text`) a name without an account.
 */
export const dayEntries = pgTable(
  "day_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    trackId: uuid("track_id")
      .notNull()
      .references(() => dayTracks.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
    approx: boolean("approx").notNull().default(false),
    place: text("place"),
    workingGroupId: uuid("working_group_id").references(() => workingGroups.id, { onDelete: "set null" }),
    personMemberId: uuid("person_member_id").references(() => members.id),
    personText: text("person_text"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => members.id),
    updatedBy: uuid("updated_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("day_entries_title", sql`char_length(${table.title}) between 1 and 120`),
    check("day_entries_start_minute", sql`${table.startMinute} between 0 and 1439`),
    check(
      "day_entries_end_minute",
      sql`${table.endMinute} is null or (${table.startMinute} is not null and ${table.endMinute} > ${table.startMinute} and ${table.endMinute} <= 1439)`
    ),
    check("day_entries_place", sql`char_length(${table.place}) <= 120`),
    check("day_entries_person_text", sql`char_length(${table.personText}) <= 80`),
    check("day_entries_person_one", sql`${table.personMemberId} is null or ${table.personText} is null`),
    check("day_entries_note", sql`char_length(${table.note}) <= 2000`),
    index("day_entries_edition_track").on(table.editionId, table.trackId),
  ]
);

export type DayEntry = typeof dayEntries.$inferSelect;

/**
 * Spec 030: checklist of a day plan entry; the person is a member or
 * (`name_text`) a name without an account.
 */
export const dayChecks = pgTable(
  "day_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => dayEntries.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    memberId: uuid("member_id").references(() => members.id),
    nameText: text("name_text"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("day_checks_text", sql`char_length(${table.text}) between 1 and 200`),
    check("day_checks_name_text", sql`char_length(${table.nameText}) <= 80`),
    check("day_checks_person_one", sql`${table.memberId} is null or ${table.nameText} is null`),
    index("day_checks_entry").on(table.entryId),
  ]
);

export type DayCheck = typeof dayChecks.$inferSelect;

/** Spec 030: roles on the D-Day ("Versammlungsleitung", …). */
export const dayRoles = pgTable(
  "day_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    title: text("title").notNull(),
    task: text("task"),
    /** How to recognise the role, e.g. "Weste lila". */
    mark: text("mark"),
    workingGroupId: uuid("working_group_id").references(() => workingGroups.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("day_roles_title", sql`char_length(${table.title}) between 1 and 80`),
    check("day_roles_task", sql`char_length(${table.task}) <= 500`),
    check("day_roles_mark", sql`char_length(${table.mark}) <= 40`),
  ]
);

export type DayRole = typeof dayRoles.$inferSelect;

/** Spec 030: people of a role, each a member or (`name_text`) a name without an account. */
export const dayRolePeople = pgTable(
  "day_role_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => dayRoles.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id),
    nameText: text("name_text"),
    position: integer("position").notNull(),
  },
  (table) => [
    check("day_role_people_name_text", sql`char_length(${table.nameText}) <= 80`),
    check("day_role_people_person_one", sql`(${table.memberId} is null) <> (${table.nameText} is null)`),
    index("day_role_people_role").on(table.roleId),
  ]
);

export type DayRolePerson = typeof dayRolePeople.$inferSelect;

/**
 * Spec 031: registrations of collectives from the public form /anmeldung.
 * Holds phone numbers (exception in AGENTS.md); all rows of an edition are
 * deleted three months after its D-Day. Lengths are checked with Zod
 * (src/lib/collectives/registration-schema.ts).
 */
export const collectiveRegistrations = pgTable(
  "collective_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    status: text("status").notNull().default("new"),
    internalNote: text("internal_note"),

    contactFirstName: text("contact_first_name").notNull(),
    contactLastName: text("contact_last_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),

    collectiveName: text("collective_name").notNull(),
    displayName: text("display_name").notNull(),
    demands: text("demands").notNull(),
    instagram: text("instagram"),
    tiktok: text("tiktok"),
    filesLink: text("files_link"),
    participatedBefore: boolean("participated_before").notNull(),
    musicType: text("music_type").notNull(),
    genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
    homeBase: text("home_base").notNull(),
    eventSize: text("event_size").notNull(),

    vehicle: text("vehicle").notNull(),
    tuev: boolean("tuev"),
    awareness: text("awareness").notNull(),
    soundCoupling: boolean("sound_coupling").notNull(),
    atmosphere: text("atmosphere").notNull(),
    orderPreference: text("order_preference"),
    jointWith: text("joint_with"),
    vehicleFilesLink: text("vehicle_files_link"),

    sectionLeadFirstName: text("section_lead_first_name"),
    sectionLeadLastName: text("section_lead_last_name"),
    sectionLeadEmail: text("section_lead_email"),
    sectionLeadPhone: text("section_lead_phone"),
    sectionLeadNote: text("section_lead_note"),

    vehicleLeadFirstName: text("vehicle_lead_first_name").notNull(),
    vehicleLeadLastName: text("vehicle_lead_last_name").notNull(),
    vehicleLeadEmail: text("vehicle_lead_email").notNull(),
    vehicleLeadSize: text("vehicle_lead_size").notNull(),
    vehicleLeadPhone: text("vehicle_lead_phone").notNull(),

    shirts: jsonb("shirts").$type<ShirtOrder>().notNull(),

    stewardsConfirmedAt: timestamp("stewards_confirmed_at", { withTimezone: true }).notNull(),
    privacyConfirmedAt: timestamp("privacy_confirmed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "collective_registrations_status",
      sql`${table.status} in ('new', 'accepted', 'waitlist', 'rejected')`
    ),
    check("collective_registrations_music_type", sql`${table.musicType} in ('live', 'dj', 'both', 'none')`),
    check(
      "collective_registrations_home_base",
      sql`${table.homeBase} in ('munich', 'munich_area', 'bavaria', 'germany', 'abroad')`
    ),
    check(
      "collective_registrations_event_size",
      sql`${table.eventSize} in ('0', '1-50', '50-200', '200-500', '500-1000', '1000+')`
    ),
    check(
      "collective_registrations_vehicle",
      sql`${table.vehicle} in ('non_motorized', 'car', 'car_trailer', 'truck_small', 'truck_large')`
    ),
    check("collective_registrations_vest_size", sql`${table.vehicleLeadSize} in ('S', 'L', 'XXL')`),
    check(
      "collective_registrations_tuev_motor",
      sql`(${table.vehicle} = 'non_motorized') = (${table.tuev} is null)`
    ),
    index("collective_registrations_edition_created").on(table.editionId, table.createdAt),
    uniqueIndex("collective_registrations_edition_name_email").on(
      table.editionId,
      sql`lower(${table.collectiveName})`,
      table.contactEmail
    ),
  ]
);

export type CollectiveRegistration = typeof collectiveRegistrations.$inferSelect;

/**
 * Spec 022: read-only view for the feedback triage, without `created_by` and
 * `updated_by`. Created by hand (scripts/sql/022-feedback-triage.sql);
 * `.existing()` makes `db:push` neither create nor drop it.
 */
export const feedbackTriage = pgView("feedback_triage", {
  id: uuid("id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  pagePath: text("page_path").notNull(),
  pageTitle: text("page_title"),
  context: text("context"),
  device: text("device"),
  viewport: text("viewport"),
  status: text("status").notNull(),
  reply: text("reply"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}).existing();
