// Verify email landing page - redirects to set-username
import { redirect } from "next/navigation";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login?error=InvalidToken");
  }

  // Redirect to API route which validates and redirects
  redirect(`/api/auth/verify-email?token=${token}`);
}
