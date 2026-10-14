import { and, asc, eq, like } from "drizzle-orm";
import { normalizeEmail } from "@/lib/access";
import { db } from "./index";
import { members, type Member } from "./schema";

export async function findMemberByEmail(email: string): Promise<Member | undefined> {
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.email, normalizeEmail(email)))
    .limit(1);
  return member;
}

export async function findMemberById(id: string): Promise<Member | undefined> {
  const [member] = await db.select().from(members).where(eq(members.id, id)).limit(1);
  return member;
}

/**
 * Called after a successful sign-in check: sets `last_login_at` and creates
 * the member on the first login of an address from `ADMIN_EMAILS`. Admins
 * stay admins (`is_admin = true`), other fields are left alone.
 */
export async function recordLogin({
  email,
  name,
  isAdmin,
}: {
  email: string;
  name: string;
  isAdmin: boolean;
}): Promise<Member> {
  const now = new Date();
  const [member] = await db
    .insert(members)
    .values({ email: normalizeEmail(email), name, isAdmin, lastLoginAt: now })
    .onConflictDoUpdate({
      target: members.email,
      set: isAdmin ? { lastLoginAt: now, isAdmin: true } : { lastLoginAt: now },
    })
    .returning();
  return member;
}

/** Test members for the dev login: active and only with @example.org. */
export async function listDevLoginMembers(): Promise<Pick<Member, "id" | "name" | "isAdmin">[]> {
  return db
    .select({ id: members.id, name: members.name, isAdmin: members.isAdmin })
    .from(members)
    .where(and(eq(members.active, true), like(members.email, "%@example.org")))
    .orderBy(asc(members.name));
}
