import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { departments, type Department } from "./schema";

/** Departments of an edition in their display order. */
export async function listDepartments(editionId: string): Promise<Department[]> {
  return db
    .select()
    .from(departments)
    .where(eq(departments.editionId, editionId))
    .orderBy(asc(departments.sortOrder), asc(departments.name));
}
