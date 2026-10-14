import { pgTable, text } from "drizzle-orm/pg-core";

/** Key/value pairs about the app itself, e.g. `seed_version` (spec 001). */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
