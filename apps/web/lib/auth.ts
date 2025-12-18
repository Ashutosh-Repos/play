// NextAuth v5 configuration - Hybrid auth with OAuth
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { prisma } from "@repo/database";
import bcrypt from "bcryptjs";
import type { UserRole, UserStatus } from "@repo/common";

// Define AuthUser type locally
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
  needsUsername?: boolean;
}

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: AuthUser;
  }
  interface User extends AuthUser {}
}

const nextAuth = NextAuth({
  providers: [
    // Credentials provider (email OR username + password)
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AuthUser | null> {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = credentials.identifier as string;
        const password = credentials.password as string;

        // Find user by email OR username
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { username: identifier }],
            deletedAt: null,
          },
          include: { channel: true },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        // Must be email verified
        if (!user.emailVerified) {
          throw new Error("Please verify your email first");
        }

        // Check status
        if (user.status !== "ACTIVE") {
          throw new Error(
            user.status === "SUSPENDED" ? "Account suspended" : "Account banned"
          );
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role as UserRole,
          status: user.status as UserStatus,
          isEmailVerified: user.emailVerified,
          channelId: user.channel?.id ?? null,
          channelHandle: user.channel?.handle ?? null,
        };
      },
    }),

    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // GitHub OAuth
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth sign in
      if (account?.provider === "google" || account?.provider === "github") {
        const profileEmail = profile?.email;
        if (!profileEmail) return false;
        const email: string = profileEmail; // Type narrowed

        // Find or create user
        let dbUser = await prisma.user.findUnique({
          where: { email },
          include: { identities: true, channel: true },
        });

        if (!dbUser) {
          // Create new user without username (will set later)
          // Use a temporary unique username
          const tempUsername = `user_${Date.now().toString(36)}`;
          const profileName = (profile as { name?: string })?.name;
          const displayName: string = profileName ?? email.split("@")[0] ?? "User";
          const avatarUrl = (profile as { picture?: string; avatar_url?: string })?.picture ?? 
                           (profile as { picture?: string; avatar_url?: string })?.avatar_url ?? null;
          
          const newUser = await prisma.user.create({
            data: {
              email,
              username: tempUsername,
              displayName,
              avatarUrl,
              emailVerified: true, // OAuth = verified
              identities: {
                create: {
                  provider: account.provider,
                  providerUserId: account.providerAccountId,
                  accessToken: account.access_token,
                  refreshToken: account.refresh_token,
                  expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                  profile: profile as object,
                },
              },
            },
          });

          // Fetch with includes
          dbUser = await prisma.user.findUnique({
            where: { id: newUser.id },
            include: { identities: true, channel: true },
          });

          // Flag that username needs to be set
          (user as AuthUser).needsUsername = true;
        } else {
          // Check if this OAuth identity exists (dbUser is non-null here)
          const existingIdentity = dbUser!.identities.find(
            (i) => i.provider === account.provider && i.providerUserId === account.providerAccountId
          );

          if (!existingIdentity) {
            // Link new OAuth identity
            await prisma.oAuthIdentity.create({
              data: {
                userId: dbUser.id,
                provider: account.provider,
                providerUserId: account.providerAccountId,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
                profile: profile as object,
              },
            });
          }

          // Check if username is temporary
          if (dbUser.username.startsWith("user_")) {
            (user as AuthUser).needsUsername = true;
          }
        }

        // Populate user object
        if (!dbUser) {
          return false; // Should never happen
        }
        user.id = dbUser.id;
        (user as AuthUser).email = dbUser.email;
        (user as AuthUser).username = dbUser.username;
        (user as AuthUser).displayName = dbUser.displayName;
        (user as AuthUser).avatarUrl = dbUser.avatarUrl;
        (user as AuthUser).role = dbUser.role as UserRole;
        (user as AuthUser).status = dbUser.status as UserStatus;
        (user as AuthUser).isEmailVerified = dbUser.emailVerified;
        (user as AuthUser).channelId = dbUser.channel?.id ?? null;
        (user as AuthUser).channelHandle = dbUser.channel?.handle ?? null;
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = (user as AuthUser).email;
        token.username = (user as AuthUser).username;
        token.displayName = (user as AuthUser).displayName;
        token.avatarUrl = (user as AuthUser).avatarUrl;
        token.role = (user as AuthUser).role;
        token.status = (user as AuthUser).status;
        token.isEmailVerified = (user as AuthUser).isEmailVerified;
        token.channelId = (user as AuthUser).channelId;
        token.channelHandle = (user as AuthUser).channelHandle;
        token.needsUsername = (user as AuthUser).needsUsername;
      }
      return token;
    },

    async session({ session, token }) {
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
        needsUsername: token.needsUsername as boolean | undefined,
      };
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Custom redirect handling
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  trustHost: true,
});

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = nextAuth.auth;
