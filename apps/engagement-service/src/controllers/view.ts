import { Request, Response } from "express";
import { bufferView } from "../services/viewCounter.js";
import { emitVideoViewed } from "../events/publisher.js";

export const recordView = async (req: Request, res: Response) => {
  const { id: videoId } = req.params;
  
  // Basic validation
  if (!videoId) return res.status(400).json({ error: "Video ID required" });

  // Get identifiers for dedup
  const userId = req.user?.sub;
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  try {
    const counted = await bufferView(videoId, ip, userId);
    
    // Emit history event if user is logged in
    if (userId) {
      emitVideoViewed(videoId, userId);
    }

    res.json({ success: true, data: { counted } });
  } catch (error) {
    console.error("View Record Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
