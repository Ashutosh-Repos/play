
import { config } from "dotenv";
import { join } from "path";

// Load .env from monorepo root BEFORE importing server code
// This prevents ESM hoisting from executing imports (like auth) before env is loaded
config({ path: join(process.cwd(), "../../.env") });

// Import the actual server logic
import("./server.js");
