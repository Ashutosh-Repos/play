import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

// Read lazily to allow environment to be loaded
const getServiceSecret = () => process.env.INTERNAL_SERVICE_SECRET;

if (!process.env.INTERNAL_SERVICE_SECRET) {
  // Warn on startup (sync) but allow running if it's set later or deemed optional
  // We check process.env directy here for the initial warning log
}

/**
 * Generate a signed JWT for internal service communication
 */
export function generateServiceToken(serviceName: string): string {
  const secret = getServiceSecret();
  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not configured");
  }

  return jwt.sign(
    { 
      sub: serviceName, 
      role: "service",
      type: "internal" 
    },
    secret,
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
  const secret = getServiceSecret();

  if (!secret) {
    console.error("INTERNAL_SERVICE_SECRET not configured on server");
    return res.status(500).json({
      success: false,
      error: { code: "CONFIG_ERROR", message: "Server misconfiguration" }
    });
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid token format" }
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as unknown as ServiceTokenPayload;
    
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
