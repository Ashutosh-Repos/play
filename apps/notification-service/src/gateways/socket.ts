import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { parse } from "cookie"; // You might need to install cookie or just parse header
// Simplified auth for MVP: Pass userId in query or header

let io: Server;

import jwt from "jsonwebtoken";
import { serverEnv } from "@repo/config";

// ... [Definition of io]

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Security Middleware - Verify JWT Token
  io.use((socket, next) => {
      // Accept token from query params or auth object
      const token = socket.handshake.auth.token || socket.handshake.query.token as string;

      if (!token) {
          return next(new Error("Authentication error: No token provided"));
      }

      try {
          // Verify JWT (use same secret as microservices)
          const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
          if (!secret) {
              console.error("JWT_SECRET not configured for WebSocket auth");
              return next(new Error("Server configuration error"));
          }

          const decoded = jwt.verify(token, secret) as any;
          
          // Next-Auth stores user in decoded.user, while direct JWT might use decoded.sub
          const userId = decoded.user?.id || decoded.sub || decoded.userId;
          
          if (!userId) {
              return next(new Error("Authentication error: Invalid token payload"));
          }
          
          // Attach user info to socket
          socket.data.userId = userId;
          socket.data.user = decoded.user || { id: userId };
          next();
      } catch (err) {
          console.error("WebSocket auth error:", err);
          next(new Error("Authentication error: Invalid or expired token"));
      }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId; // Trusted from JWT
    
    if (userId) {
        // Join their personal room
        socket.join(`user:${userId}`);
        console.log(`🔌 User ${userId} connected to WebSocket (Authenticated)`);
    }

    socket.on("disconnect", () => {
       // Disconnect logic
    });
  });
  
  return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// Helper to push notification
export const pushNotification = (userId: string, event: string, data: any) => {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
};
