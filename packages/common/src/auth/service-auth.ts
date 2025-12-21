import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;

if (!SERVICE_SECRET) {
  // Warn on startup but don't crash, as some scripts might import this without env
  console.warn("⚠️ INTERNAL_SERVICE_SECRET is not set. Service-to-Service auth will fail.");
}

/**
 * Generate a signed JWT for internal service communication
 */
export function generateServiceToken(serviceName: string): string {
  if (!SERVICE_SECRET) {
    throw new Error("INTERNAL_SERVICE_SECRET is not configured");
  }

  return jwt.sign(
    { 
      sub: serviceName, 
      role: "service",
      type: "internal" 
    },
    SERVICE_SECRET,
    { expiresIn: "5m" } // Short-lived tokens
  );
}

interface ServiceTokenPayload {
  sub: string;
  role: string;
  type: string;
}

/**
 * Middleware to verify internal service requests
 */
export function verifyServiceToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" }
    });
  }

  const token = authHeader.split(" ")[1];

  if (!SERVICE_SECRET) {
    console.error("INTERNAL_SERVICE_SECRET not configured on server");
    return res.status(500).json({
      success: false,
      error: { code: "CONFIG_ERROR", message: "Server misconfiguration" }
    });
  }

  try {
    const decoded = jwt.verify(token, SERVICE_SECRET) as ServiceTokenPayload;
    
    if (decoded.role !== "service" || decoded.type !== "internal") {
        return res.status(403).json({
            success: false,
            error: { code: "FORBIDDEN", message: "Invalid token type" }
        });
    }

    // Attach service info to request if needed (e.g. req.serviceName = decoded.sub)
    (req as any).serviceName = decoded.sub;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid service token" }
    });
  }
}
