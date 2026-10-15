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
