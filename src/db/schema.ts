import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { check, date, index, integer, primaryKey, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
 * `fixed_date`; while it is set, `shift_days` is ignored.
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
    /** Shift against the latest date: negative = earlier (buffer), positive = later (delay). */
    shiftDays: integer("shift_days").notNull().default(0),
    fixedDate: date("fixed_date", { mode: "string" }),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    /** "Wackelt" as a manual assessment. */
    wobbly: boolean("wobbly").notNull().default(false),
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
    index("plan_elements_edition").on(table.editionId, table.sortOrder),
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
