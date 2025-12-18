// @repo/config - Typed environment variable configuration
// Use @repo/config/server for server-side env vars
// Use @repo/config/client for client-side (NEXT_PUBLIC_*) env vars

export { serverEnv, type ServerEnv } from "./server.js";
export { clientEnv, type ClientEnv } from "./client.js";

