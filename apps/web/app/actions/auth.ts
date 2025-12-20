"use server";

import { prisma } from "@repo/database";
import { registerSchema, onboardingSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";
import { addUsername } from "@/lib/bloomFilter";
import { UserStatus } from "@repo/common";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function registerAction(data: unknown) {
  const result = registerSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: "Invalid input" };
  }

  const { email, password } = result.data;

  // Rate Limit: 3 attempts per IP per hour (using email as key for now, ideally IP)
  // Since we are in a server action, getting IP is tricky without passing it.
  // We will rate limit by EMAIL address to prevent spamming a single target.
  // And we should also limit globally or by a fingerprint if possible. 
  // For now, limiting by Email + generic spam check.
  
  const rateLimit = await checkRateLimit(
    `register:${email.toLowerCase()}`,
    RATE_LIMITS.register.limit,
    RATE_LIMITS.register.windowSeconds
  );

  if (!rateLimit.allowed) {
    return { success: false, error: "Too many registration attempts. Please try again later." };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
        return { success: false, error: "Email already in use" };
    }

    const hashedPassword = await hashPassword(password);
    const tempUsername = `user_${crypto.randomBytes(4).toString("hex")}`;
    const token = crypto.randomBytes(32).toString("hex");

    // 1. Create User & Token in Transaction
    // We do this first to ensure DB integrity
    const { user } = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                username: tempUsername,
                displayName: email.split("@")[0] || "User",
                status: UserStatus.PROVISIONED,
            },
        });

        await tx.emailVerificationToken.create({
            data: {
                userId: newUser.id,
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
        });

        return { user: newUser };
    });

    // 2. Send Email
    // If this fails, we must rollback (delete) the user so they can try again.
    try {
        await sendVerificationEmail(email, token);
    } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        
        // Manual Rollback
        await prisma.user.delete({ where: { id: user.id } });
        
        return { success: false, error: "Failed to send verification email. Please try again." };
    }

    return { success: true, message: "Verification email sent" };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Something went wrong" };
  }
}

export async function completeOnboardingAction(data: unknown) {
  const session = await auth();

  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = onboardingSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: "Invalid input" };
  }

  // Rate Limit: 10 per hour per User
  const rateLimit = await checkRateLimit(
    `onboarding:${session.user.id}`,
    10,
    3600
  );

  if (!rateLimit.allowed) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const { username, displayName, bio, avatarUrl } = result.data;

  try {
    // Transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
        // Update User
        await tx.user.update({
            where: { id: session.user.id },
            data: {
                username,
                displayName: displayName || username,
                avatarUrl,
                bio,
                status: UserStatus.ACTIVE,
            }
        });
    });

    // Side effects after commit
    await addUsername(username);
    
    // Revalidate paths to reflect user status change
    revalidatePath("/", "layout");
    
    return { success: true };

  } catch (error: any) {
    console.error("Onboarding error:", error);
    
    // Handle Prisma Unique Constraint Violation
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        return { success: false, error: "Username already taken" };
    }

    return { success: false, error: "Failed to update profile" };
  }
}

// Imports for password reset actions
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  setPasswordResetToken, 
  getPasswordResetToken, 
  deletePasswordResetToken 
} from "@/lib/redis";
import { sendPasswordResetEmail } from "@/lib/email";
import { revokeAllUserTokens } from "@/lib/tokens";
import { v4 as uuid } from "uuid";

export async function forgotPasswordAction(data: unknown) {
  const result = forgotPasswordSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: "Invalid email address" };
  }

  const { email } = result.data;
  
  try {
     // Rate limit by email
    const rateLimit = await checkRateLimit(
      `passwordReset:${email.toLowerCase()}`,
      RATE_LIMITS.passwordReset.limit,
      RATE_LIMITS.passwordReset.windowSeconds
    );

    if (!rateLimit.allowed) {
      return { success: false, error: "Too many requests. Please try again later." };
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true, message: "If the email exists, a reset link has been sent." };
    }

    // Generate token
    const token = uuid();

    // Store in Redis (1 hour TTL, auto-expires)
    await setPasswordResetToken(token, { 
      userId: user.id, 
      email: user.email 
    });

    // Send email
    await sendPasswordResetEmail(email, token);

    return { success: true, message: "If the email exists, a reset link has been sent." };

  } catch (error) {
    console.error("Forgot password error:", error);
    return { success: false, error: "Something went wrong" };
  }
}

export async function resetPasswordAction(data: unknown) {
  const result = resetPasswordSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: "Invalid input" };
  }

  const { token, password } = result.data;

  try {
    // Get token from Redis
    const resetData = await getPasswordResetToken(token);

    if (!resetData) {
      return { success: false, error: "Invalid or expired reset link" };
    }

    const user = await prisma.user.findUnique({ 
      where: { id: resetData.userId } 
    });

    if (!user) {
      await deletePasswordResetToken(token);
      return { success: false, error: "User not found" };
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    await deletePasswordResetToken(token);
    await revokeAllUserTokens(user.id);

    return { success: true, message: "Password reset successfully" };

  } catch (error) {
    console.error("Reset password error:", error);
    return { success: false, error: "Failed to reset password" };
  }
}
