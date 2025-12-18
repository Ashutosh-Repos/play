import { flushViewsToDB } from "../services/viewCounter.js";

export function startBackgroundJobs() {
  console.log("⏰ Starting Engagement Background Jobs...");

  // Flush views every 10 seconds
  setInterval(async () => {
    try {
        await flushViewsToDB();
    } catch (err) {
        console.error("Flush Views Job Failed:", err);
    }
  }, 10 * 1000);
}
