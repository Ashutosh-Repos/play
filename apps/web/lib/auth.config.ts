
import type { NextAuthConfig } from "next-auth";
import { UserStatus, type UserRole } from "@repo/common";

// Define AuthUser type locally for now (duplicated from auth.ts temporarily, will consolidate later)
interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  channelId?: string | null;
  channelHandle?: string | null;
}

declare module "next-auth" {
  interface Session {
    user: AuthUser;
  }
  interface User extends AuthUser {}
}

export const authConfig = {
  providers: [], // Providers configured in auth.ts (node env)
  
  pages: {
    signIn: "/login",
    error: "/login",
  },
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // This callback is "safe" because it just reads from the token.
    // The "heavy lifting" of fetching from DB happens in the JWT callback in auth.ts
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          emailVerified: null,
          username: token.username as string | null,
          displayName: token.displayName as string,
          avatarUrl: token.avatarUrl as string | null | undefined,
          role: token.role as UserRole,
          status: token.status as UserStatus,
          isEmailVerified: Boolean(token.isEmailVerified),
          channelId: token.channelId as string | null | undefined,
          channelHandle: token.channelHandle as string | null | undefined,
        };
      }
      return session;
    },

    // Redirect logic acts on URLs, safe for Edge.
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return baseUrl;
    },
    
    // Authorization check (optional, but we use Middleware for this)
    async authorized({ auth }) {
      return !!auth;
    }
  },

  // Trust host for Vercel/proxies
  trustHost: true,

} satisfies NextAuthConfig;
