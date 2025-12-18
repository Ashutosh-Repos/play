import { z } from "zod";

/**
 * Client-side environment variables schema
 * These ARE exposed to the browser - ONLY use NEXT_PUBLIC_* prefix
 * Used by: Next.js client components (browser)
 *
 * ⚠️ NEVER put secrets here - these are bundled into the JS and visible to users!
 */
const clientEnvSchema = z.object({
  // API URL for frontend to call backend
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),

  // WebSocket URL for real-time features
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),

  // Public MinIO URL for video/image assets
  NEXT_PUBLIC_MINIO_URL: z.string().url().default("http://localhost:9000"),

  // App info
  NEXT_PUBLIC_APP_NAME: z.string().default("Play"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

// Parse client environment variables
// Must explicitly pass each NEXT_PUBLIC_* var for Next.js bundling
function getClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_MINIO_URL: process.env.NEXT_PUBLIC_MINIO_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    console.error("❌ Invalid client environment variables:");
    console.error(parsed.error.flatten().fieldErrors);

    // Return defaults
    return clientEnvSchema.parse({});
  }

  return parsed.data;
}

export const clientEnv = getClientEnv();
export type ClientEnv = z.infer<typeof clientEnvSchema>;
