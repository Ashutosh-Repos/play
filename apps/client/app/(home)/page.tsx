import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  
  return (
    <div>Home Page</div>
  );
}
