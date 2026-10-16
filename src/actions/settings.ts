"use server";

import { and, eq, max, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { listDepartments } from "@/db/departments";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { departments, editions, members } from "@/db/schema";
import { parseAdminEmails } from "@/lib/access";
import { canManage, moveItem, type ManageAction } from "@/lib/permissions";

/** Result shown next to the form; null before the first submit. */
export type ActionState = { ok: boolean; message: string } | null;

const INVITED_MESSAGE =
  "Eingeladen. Solange die Google-Anmeldung im Testmodus ist, die Adresse zusätzlich in der Google Console als Testnutzer eintragen – sonst klappt der Login nicht.";

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

function fail(message: string): ActionState {
  return { ok: false, message };
}

/**
 * Checks the acting member against the database on every call: `isAdmin`
 * from the session may be outdated after the right was taken away.
 */
async function authorize(
  action: ManageAction,
  target: { id: string; email: string } | null = null
): Promise<ActionState> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  const result = canManage(actor, target, parseAdminEmails(process.env.ADMIN_EMAILS), action);
  return result.ok ? null : fail(result.error);
}

const dDayInput = z.object({ dDay: z.iso.date() });

export async function updateDDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const parsed = dDayInput.safeParse({ dDay: formData.get("dDay") });
  if (!parsed.success) return fail("Bitte ein gültiges Datum eingeben.");

  const updated = await db
    .update(editions)
    .set({ dDay: parsed.data.dDay })
    .where(eq(editions.isCurrent, true))
    .returning({ id: editions.id });
  if (updated.length === 0) return fail("Keine aktuelle Ausgabe gefunden.");

  refresh();
  return { ok: true, message: "Datum der Krachparade gespeichert." };
}

const inviteInput = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(100, "Der Name ist zu lang."),
  email: z.string().trim().toLowerCase().pipe(z.email("Bitte eine gültige E-Mail-Adresse eingeben.")),
});

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const parsed = inviteInput.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  try {
    const inserted = await db
      .insert(members)
      .values({ name: parsed.data.name, email: parsed.data.email })
      .onConflictDoNothing({ target: members.email })
      .returning({ id: members.id });
    if (inserted.length === 0) return fail("Diese Adresse ist schon eingeladen.");
  } catch {
    // Query errors carry their parameters (the e-mail address): not logged.
    return fail(GENERIC_ERROR);
  }

  refresh();
  return { ok: true, message: INVITED_MESSAGE };
}

const memberFlagInput = z.object({
  memberId: z.uuid(),
  value: z.enum(["true", "false"]).transform((value) => value === "true"),
});

async function loadTarget(formData: FormData) {
  const parsed = memberFlagInput.safeParse({
    memberId: formData.get("memberId"),
    value: formData.get("value"),
  });
  if (!parsed.success) return null;
  const target = await findMemberById(parsed.data.memberId);
  return target ? { target, value: parsed.data.value } : null;
}

export async function setMemberActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const input = await loadTarget(formData);
  if (!input) return fail("Diese Person gibt es nicht.");
  const { target, value } = input;

  const deniedForTarget = await authorize(value ? "activate" : "deactivate", target);
  if (deniedForTarget) return deniedForTarget;

  await db.update(members).set({ active: value }).where(eq(members.id, target.id));
  refresh();
  return { ok: true, message: value ? "Wieder aktiviert." : "Deaktiviert." };
}

export async function setMemberAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const input = await loadTarget(formData);
  if (!input) return fail("Diese Person gibt es nicht.");
  const { target, value } = input;

  const deniedForTarget = await authorize(value ? "grantAdmin" : "revokeAdmin", target);
  if (deniedForTarget) return deniedForTarget;

  await db.update(members).set({ isAdmin: value }).where(eq(members.id, target.id));
  refresh();
  return { ok: true, message: value ? "Ist jetzt Admin." : "Admin-Recht entfernt." };
}

const departmentName = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(100, "Der Name ist zu lang.");

const DUPLICATE_DEPARTMENT = "Dieses Referat gibt es schon.";

export async function createDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const parsed = departmentName.safeParse(formData.get("name"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const edition = await getCurrentEdition();
  if (!edition) return fail("Keine aktuelle Ausgabe gefunden.");

  const [{ last }] = await db
    .select({ last: max(departments.sortOrder) })
    .from(departments)
    .where(eq(departments.editionId, edition.id));
  const inserted = await db
    .insert(departments)
    .values({ editionId: edition.id, name: parsed.data, sortOrder: (last ?? 0) + 1 })
    .onConflictDoNothing()
    .returning({ id: departments.id });
  if (inserted.length === 0) return fail(DUPLICATE_DEPARTMENT);

  refresh();
  return { ok: true, message: "Referat angelegt." };
}

const departmentId = z.uuid();

/** The department from the form, only if it belongs to the current edition. */
async function loadDepartment(formData: FormData) {
  const parsed = departmentId.safeParse(formData.get("departmentId"));
  if (!parsed.success) return undefined;
  const edition = await getCurrentEdition();
  if (!edition) return undefined;
  const [department] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, parsed.data), eq(departments.editionId, edition.id)))
    .limit(1);
  return department;
}

export async function renameDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const department = await loadDepartment(formData);
  if (!department) return fail("Dieses Referat gibt es nicht.");
  const parsed = departmentName.safeParse(formData.get("name"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const [taken] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(
      and(
        eq(departments.editionId, department.editionId),
        eq(departments.name, parsed.data),
        ne(departments.id, department.id)
      )
    )
    .limit(1);
  if (taken) return fail(DUPLICATE_DEPARTMENT);

  await db.update(departments).set({ name: parsed.data }).where(eq(departments.id, department.id));
  refresh();
  return { ok: true, message: "Umbenannt." };
}

const leadInput = z.union([z.literal(""), z.uuid()]);

export async function setDepartmentLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const department = await loadDepartment(formData);
  if (!department) return fail("Dieses Referat gibt es nicht.");
  const parsed = leadInput.safeParse(formData.get("leadId") ?? "");
  if (!parsed.success) return fail("Diese Person gibt es nicht.");

  let leadId: string | null = null;
  if (parsed.data !== "") {
    const lead = await findMemberById(parsed.data);
    if (!lead) return fail("Diese Person gibt es nicht.");
    if (!lead.active) return fail("Nur aktive Personen können ein Referat leiten.");
    leadId = lead.id;
  }

  await db.update(departments).set({ leadId }).where(eq(departments.id, department.id));
  refresh();
  return { ok: true, message: "Leitung gespeichert." };
}

const directionInput = z.enum(["up", "down"]);

export async function moveDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("write");
  if (denied) return denied;

  const department = await loadDepartment(formData);
  if (!department) return fail("Dieses Referat gibt es nicht.");
  const direction = directionInput.safeParse(formData.get("direction"));
  if (!direction.success) return fail(GENERIC_ERROR);

  const ids = (await listDepartments(department.editionId)).map((item) => item.id);
  const order = moveItem(ids, department.id, direction.data);
  if (!order) return null;

  // Rewrites all positions as 1, 2, 3 … in one transaction.
  const [first, ...rest] = order.map((id, index) =>
    db.update(departments).set({ sortOrder: index + 1 }).where(eq(departments.id, id))
  );
  await db.batch([first, ...rest]);
  refresh();
  return null;
}
