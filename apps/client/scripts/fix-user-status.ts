
import { prisma } from "@repo/database";

async function main() {
  console.log("--- Checking User Status ---");
  const email = "testuser@example.com";
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        console.error("User not found");
        process.exit(1);
    }

    console.log(`Current status for ${email}: ${user.status}`);

    if (user.status !== "ACTIVE") {
        console.log("Updating status to ACTIVE...");
        await prisma.user.update({
            where: { id: user.id },
            data: { status: "ACTIVE" }
        });
        console.log("✅ User status updated to ACTIVE");
    } else {
        console.log("✅ User is already ACTIVE");
    }

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
