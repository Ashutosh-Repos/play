import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;
  const isLoggedIn = !!session;
  const { pathname } = req.nextUrl;
  // Protected routes that require authentication
  const protectedRoutes = ["/settings", "/onboarding"]; // Example, though settings page is deleted, we might re-add. For now, minimal.
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Routes that require a channel (creator features)
  const channelRequiredRoutes: string[] = []; // No creator pages left
  const requiresChannel = channelRequiredRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Admin routes - require ADMIN role
  const isAdminRoute = pathname.startsWith("/admin");

  // Auth routes - redirect if already logged in
  const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Handle admin routes - silent redirect for non-admins
  if (isAdminRoute) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Silent redirect for non-admins (no error page - they don't know admin exists)
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  // Handle protected routes
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Handle auth routes - redirect if already logged in
  if (isAuthRoute && isLoggedIn) {
    // Check if user is in PROVISIONED state (needs onboarding)
    if (session?.user?.status === "PROVISIONED" && pathname !== "/onboarding") {
      console.log("[MIDDLEWARE_DEBUG] Auth route -> Redirect to Onboarding", { status: session?.user?.status });
      return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
    }
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // Check if logged in user is PROVISIONED
  if (isLoggedIn && session?.user?.status === "PROVISIONED" && pathname !== "/onboarding" && !isAuthRoute) {
    console.log("[MIDDLEWARE_DEBUG] Protected/Public route -> Redirect to Onboarding", { status: session?.user?.status, pathname });
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  // Check if user needs a channel for creator features
  if (isLoggedIn && requiresChannel && !session?.user?.channelId && pathname !== "/create-channel") {
    return NextResponse.redirect(new URL("/create-channel", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|logo.svg|.*\\.png|.*\\.jpg|.*\\.webp).*)"],
};

