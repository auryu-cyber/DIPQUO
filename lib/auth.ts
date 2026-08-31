import type { NextAuthOptions, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/admin";
import { appendLog } from "@/lib/logs";

interface GoogleProfile extends Profile {
  hd?: string;
}

const allowedDomain = process.env.ALLOWED_GOOGLE_DOMAIN ?? "kunomura.com";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      const hd = (profile as GoogleProfile | undefined)?.hd;
      const email = user.email ?? "unknown";
      const allowed = hd === allowedDomain;

      // Best-effort audit log; a logging failure must never block (or silently allow) sign-in.
      try {
        await appendLog(
          "login",
          {
            type: "login",
            at: new Date().toISOString(),
            user: email,
            result: allowed ? "success" : "failed_unauthorized_domain",
          },
          "system@dipquo.internal"
        );
      } catch (err) {
        console.error("Failed to write login log", err);
      }

      return allowed;
    },
    async jwt({ token }) {
      if (token.email) {
        try {
          token.isAdmin = await isAdminEmail(token.email);
        } catch (err) {
          console.error("Failed to resolve admin status", err);
          token.isAdmin = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
};
