
import { prisma } from "@repo/database";

async function main() {
  const email = "clashutosh04@gmail.com";
  console.log(`Checking status for ${email}...`);

  const user = await prisma.user.findFirst({ where: { email } });
  
  if (!user) {
    console.log("User not found.");
    return;
  }

  console.log(`Current Status: ${user.status}`);

  if (user.status !== "ACTIVE") {
    console.log("Updating to ACTIVE...");
    await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" }
    });
    console.log("✅ User Activated.");
  } else {
    console.log("✅ User is already ACTIVE.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
