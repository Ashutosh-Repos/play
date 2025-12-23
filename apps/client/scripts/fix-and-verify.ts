
import { prisma } from "@repo/database";

async function main() {
  console.log("--- Starting Fix and Verify (Simplified) ---");

  // 1. Fix User Email Verification
  const email = "testuser@example.com";
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      console.log(`Found user: ${user.email}, emailVerified: ${user.emailVerified}`);
      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
        console.log("Updated user: emailVerified set to TRUE");
      } else {
        console.log("User already verified.");
      }
    } else {
      console.error("User not found!");
    }
  } catch (e) {
    console.error("Database error:", e);
  }

  // 2. Test Video Service Connection (Direct Fetch)
  console.log("\n--- Testing Video Service Feed (Direct) ---");
  const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || "http://localhost:4003";
  try {
    console.log(`Fetching from: ${VIDEO_SERVICE_URL}/videos?limit=5`);
    const response = await fetch(`${VIDEO_SERVICE_URL}/videos?limit=5`);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Video Service connection: SUCCESS");
      // console.log("Feed data:", JSON.stringify(data, null, 2));
    } else {
      console.error(`Video Service connection: FAILED (${response.status})`);
      console.error(await response.text());
    }
  } catch (error) {
    console.error("Video Service connection: CRASHED/UNREACHABLE", error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
