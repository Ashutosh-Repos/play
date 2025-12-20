/**
 * Seed Admin User Script
 * 
 * Run with: pnpm exec tsx src/seed-admin.ts
 * 
 * This script creates a default admin user for testing/initial deployment.
 * In production, you would typically:
 * 1. Set admin credentials via environment variables
 * 2. Run this only during initial deployment
 * 3. Change the password immediately after first login
 */

import { prisma } from "./client";
import bcrypt from "bcryptjs";

const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL || "admin@play.local",
  password: process.env.ADMIN_PASSWORD || "Admin@123",
  username: "admin",
  displayName: "Platform Admin",
};

async function seedAdmin() {
  console.log("🌱 Seeding admin user...\n");

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { 
      OR: [
        { email: DEFAULT_ADMIN.email },
        { username: DEFAULT_ADMIN.username },
        { role: "ADMIN" }
      ]
    }
  });

  if (existingAdmin) {
    console.log("ℹ️  Admin user already exists:");
    console.log(`   Email: ${existingAdmin.email}`);
    console.log(`   Username: ${existingAdmin.username}`);
    console.log(`   Role: ${existingAdmin.role}`);
    return existingAdmin;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: DEFAULT_ADMIN.email,
      username: DEFAULT_ADMIN.username,
      displayName: DEFAULT_ADMIN.displayName,
      passwordHash,
      role: "ADMIN",
      emailVerified: true,
      status: "ACTIVE",
    },
  });

  console.log("✅ Admin user created:");
  console.log(`   Email: ${admin.email}`);
  console.log(`   Username: ${admin.username}`);
  console.log(`   Password: ${DEFAULT_ADMIN.password}`);
  console.log(`   Role: ${admin.role}`);
  console.log("\n⚠️  Change the password after first login!");

  return admin;
}

// Also create a regular test user
async function seedTestUser() {
  console.log("\n🌱 Seeding test user...\n");

  const existingUser = await prisma.user.findUnique({
    where: { email: "user@play.local" }
  });

  if (existingUser) {
    console.log("ℹ️  Test user already exists:");
    console.log(`   Email: ${existingUser.email}`);
    return existingUser;
  }

  const passwordHash = await bcrypt.hash("User@123", 12);

  const user = await prisma.user.create({
    data: {
      email: "user@play.local",
      username: "testuser",
      displayName: "Test User",
      passwordHash,
      role: "USER",
      emailVerified: true,
      status: "ACTIVE",
    },
  });

  console.log("✅ Test user created:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   Password: User@123`);
  console.log(`   Role: ${user.role}`);

  return user;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     PLAY PLATFORM - DATABASE SEED                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    await seedAdmin();
    await seedTestUser();
    
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║     ✅ SEED COMPLETE                                       ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
