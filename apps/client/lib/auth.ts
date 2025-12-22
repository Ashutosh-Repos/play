// NextAuth v5 configuration - Hybrid auth with OAuth
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { prisma } from "@repo/database";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { UserStatus, type UserRole } from "@repo/common";
import { authConfig } from "./auth.config";

// Extend NextAuth types (keeping this for type safety in this file)
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
  sessionId?: string | null; // RefreshToken ID for session tracking
}

declare module "next-auth" {
  interface Session {
    user: AuthUser;
  }
  interface User extends AuthUser {}
}

const nextAuth = NextAuth({
  ...authConfig,
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
        if (
          user.status !== "ACTIVE" &&
          user.status !== UserStatus.PROVISIONED
        ) {
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
     // Extend the base callbacks with DB logic
    ...authConfig.callbacks,

    async signIn({ user, account, profile }) {
      console.log("[AUTH_DEBUG] signIn start", { email: user.email, accountId: account?.providerAccountId });
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
          console.log("[AUTH_DEBUG] Creating new PROVISIONED user");
          // Create new user without username (will set later)
          // Use a temporary unique username with a distinct prefix (max 30 chars)
          // "paramoun_" + 8 chars = 17 chars. Safe.
          const tempUsername = `user_${uuid().substring(0, 8)}_${Math.floor(Math.random() * 1000)}`;
          const profileName = (profile as { name?: string })?.name;
          // Ensure display name fits varchar(50)
          const rawDisplayName = profileName ?? email.split("@")[0] ?? "User";
          const displayName: string = rawDisplayName.substring(0, 50);
          const avatarUrl = (profile as { picture?: string; avatar_url?: string })?.picture ?? 
                           (profile as { picture?: string; avatar_url?: string })?.avatar_url ?? null;
          
          const newUser = await prisma.user.create({
            data: {
              email,
              username: tempUsername,
              displayName,
              avatarUrl,
              emailVerified: true, // OAuth = verified
              status: UserStatus.PROVISIONED, // Needs onboarding
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

          // Flag that username needs to be set - status is PROVISIONED
        } else {
          console.log("[AUTH_DEBUG] Found existing user", { id: dbUser.id, status: dbUser.status });
          // Check if this OAuth identity exists (dbUser is non-null here)
          const existingIdentity = dbUser!.identities.find(
            (i) => i.provider === account.provider && i.providerUserId === account.providerAccountId
          );

          // Check for BANNED/SUSPENDED status
          if (dbUser.status === UserStatus.BANNED) {
            console.log("Blocking banned user login:", dbUser.email);
            return false;
          }
          if (dbUser.status === UserStatus.SUSPENDED) {
             console.log("Blocking suspended user login:", dbUser.email);
             return false;
          }

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


        }

        // Populate user object
        if (!dbUser) {
          return false; // Should never happen
        }
        
      }

      return true;
    },

    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        console.log("[AUTH_DEBUG] jwt initial call - fetching user from DB to ensure sync", { email: user.email });
        
        // Fetch authoritative user data from DB by email
        // We cannot rely on 'signIn' mutations persisting here
        const dbUser = await prisma.user.findFirst({
           where: { email: user.email as string },
           include: { channel: true }
        });

        if (dbUser) {
           console.log("[AUTH_DEBUG] jwt user found", { id: dbUser.id, status: dbUser.status });
           token.id = dbUser.id;
           token.email = dbUser.email;
           token.username = dbUser.username;
           token.displayName = dbUser.displayName;
           token.avatarUrl = dbUser.avatarUrl;
           token.role = dbUser.role as UserRole;
           token.status = dbUser.status as UserStatus;
           token.isEmailVerified = dbUser.emailVerified;
           token.channelId = dbUser.channel?.id ?? null;
           token.channelHandle = dbUser.channel?.handle ?? null;

           // Create a session record for tracking active sessions
           // This enables proper session management in the frontend
           const sessionToken = await prisma.refreshToken.create({
             data: {
               userId: dbUser.id,
               tokenHash: `nextauth_${uuid()}`, // Unique identifier for this session
               expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
               userAgent: null, // Will be set from request headers if available
               ipAddress: null,
             },
           });
           token.sessionId = sessionToken.id;
           console.log("[AUTH_DEBUG] Created session record", { sessionId: sessionToken.id });
        } else {
             console.error("[AUTH_DEBUG] CRITICAL: User verified in signIn but not found in jwt");
             // Fallback to what we have (shouldn't happen if flow is correct)
             token.id = user.id;
        }
      }

      // Handle session updates (e.g. client side update() call)
      if (trigger === "update") {
           console.log("[AUTH_DEBUG] jwt update trigger", session);
           // Allow updating specific fields if passed, or trigger a re-fetch
           // For now, let's just re-fetch to be safe
           const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              include: { channel: true },
           });
           if (dbUser) {
              token.status = dbUser.status as UserStatus;
              token.username = dbUser.username;
              token.displayName = dbUser.displayName;
              token.avatarUrl = dbUser.avatarUrl;
              token.bio = dbUser.bio;
              token.channelId = dbUser.channel?.id ?? null;
              token.channelHandle = dbUser.channel?.handle ?? null;
           }
      }

      // If status is PROVISIONED, always re-fetch to check if onboarding is complete.
      // This prevents users from getting stuck in an onboarding loop if the client-side update() fails.
      if (token.status === UserStatus.PROVISIONED && !user) {
          // fetch lightweight
           const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              include: { channel: true },
           });

           if (dbUser) {
              console.log("[AUTH_DEBUG] Auto-refreshing PROVISIONED user status:", dbUser.status);
              token.status = dbUser.status as UserStatus;
              
              // If they are now ACTIVE, sync the new profile data
              if (dbUser.status === UserStatus.ACTIVE) {
                  token.username = dbUser.username;
                  token.displayName = dbUser.displayName;
                  token.avatarUrl = dbUser.avatarUrl;
                  token.bio = dbUser.bio;
                  token.channelId = dbUser.channel?.id ?? null;
                  token.channelHandle = dbUser.channel?.handle ?? null;
              }
           }
      }
      
      return token;
    },
  },
});

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = nextAuth.auth;
