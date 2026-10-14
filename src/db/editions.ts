import { eq } from "drizzle-orm";
import { db } from "./index";
import { editions, type Edition } from "./schema";

/** The current edition, or undefined before the first seed. */
export async function getCurrentEdition(): Promise<Edition | undefined> {
  const [edition] = await db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1);
  return edition;
}
