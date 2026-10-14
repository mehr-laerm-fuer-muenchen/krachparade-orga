import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { date, integer, unique, uniqueIndex } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("editions_one_current").on(table.isCurrent).where(sql`${table.isCurrent}`)]
);

export type Edition = typeof editions.$inferSelect;

/** Departments of an edition ("Referate" in the UI), with an optional lead (spec 003). */
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id),
    name: text("name").notNull(),
    leadId: uuid("lead_id").references(() => members.id),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("departments_edition_name").on(table.editionId, table.name)]
);

export type Department = typeof departments.$inferSelect;
