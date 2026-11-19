import NextAuth, { type DefaultSession } from "next-auth";
import type {} from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findMemberByEmail, findMemberById, recordLogin } from "@/db/members";
import { isAdminEmail, isAllowed, parseAdminEmails } from "@/lib/access";
import {
  DEV_LOGIN_PROVIDER,
  devLoginEnvFromProcess,
  isDevLoginEmail,
  isDevLoginEnabled,
} from "@/lib/dev-login";

declare module "next-auth" {
  interface Session {
    memberId: string;
    isAdmin: boolean;
    user: { name: string } & Omit<DefaultSession["user"], "email" | "image">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    memberId?: string;
    isAdmin?: boolean;
  }
}

/** Shown on /login when the sign-in check refuses an account. */
export const ACCESS_DENIED_ERROR = "AccessDenied";

const devLoginInput = z.object({ memberId: z.uuid() });

function adminEmails(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

// The dev login exists only locally and in previews or the demo (spec 001) and
// only signs in seeded test members with @example.org addresses.
const devLogin = Credentials({
  id: DEV_LOGIN_PROVIDER,
  name: "Dev-Login",
  credentials: { memberId: {} },
  async authorize(credentials) {
    if (!isDevLoginEnabled(devLoginEnvFromProcess())) {
      return null;
    }
    const parsed = devLoginInput.safeParse(credentials);
    if (!parsed.success) {
      return null;
    }
    const member = await findMemberById(parsed.data.memberId);
    if (!member || !member.active || !isDevLoginEmail(member.email)) {
      return null;
    }
    return { id: member.id, name: member.name, email: member.email };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ authorization: { params: { scope: "openid email profile" } } }),
    ...(isDevLoginEnabled(devLoginEnvFromProcess()) ? [devLogin] : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  // Auth.js would log causes (e.g. failed queries with their parameters),
  // which can contain e-mail addresses. Only error names go to the log.
  logger: {
    error(error) {
      console.error(`[auth] ${error.name}`);
    },
    warn(code) {
      console.warn(`[auth] ${code}`);
    },
    debug() {},
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === DEV_LOGIN_PROVIDER) {
        // `authorize` has already checked the member.
        return true;
      }
      if (account?.provider !== "google" || profile?.email_verified !== true) {
        return false;
      }
      const email = user.email;
      if (!email) {
        return false;
      }
      const admins = adminEmails();
      const member = await findMemberByEmail(email);
      if (!isAllowed(email, member ? [member] : [], admins)) {
        return false;
      }
      await recordLogin({
        email,
        name: user.name?.trim() || email.split("@")[0],
        isAdmin: isAdminEmail(email, admins),
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        // Only on sign-in: store the member, not the e-mail address.
        const member = await findMemberByEmail(user.email);
        if (!member) {
          throw new Error("Member missing after sign-in");
        }
        return {
          sub: member.id,
          memberId: member.id,
          name: member.name,
          isAdmin: member.isAdmin || isAdminEmail(member.email, adminEmails()),
        };
      }
      return token;
    },
    session({ session, token }) {
      return {
        expires: session.expires,
        memberId: token.memberId ?? "",
        isAdmin: token.isAdmin ?? false,
        user: { name: token.name ?? "" },
      };
    },
  },
});

export type CurrentMember = {
  id: string;
  name: string;
  isAdmin: boolean;
};

/**
 * For pages and server actions: the signed-in, still active member, checked
 * against the database. Redirects to /login otherwise. The proxy only does
 * the quick cookie check.
 */
export async function requireMember(): Promise<CurrentMember> {
  const session = await auth();
  if (!session?.memberId) {
    redirect("/login");
  }
  const member = await findMemberById(session.memberId);
  const admin = member ? isAdminEmail(member.email, adminEmails()) : false;
  if (!member || (!member.active && !admin)) {
    redirect(`/login?error=${ACCESS_DENIED_ERROR}`);
  }
  return { id: member.id, name: member.name, isAdmin: member.isAdmin || admin };
}
