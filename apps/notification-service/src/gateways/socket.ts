import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { parse } from "cookie"; // You might need to install cookie or just parse header
// Simplified auth for MVP: Pass userId in query or header
import { verifyToken } from "@repo/common";

let io: Server;

import jwt from "jsonwebtoken";
import { serverEnv } from "@repo/config";

// ... [Definition of io]

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: serverEnv.ALLOWED_ORIGINS?.split(',') || "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Security Middleware - Verify JWT Token
  io.use((socket, next) => {
      // Accept token from query params or auth object
      const token = socket.handshake.auth.token || socket.handshake.query.token as string;

      if (!token) {
          return next(new Error("Authentication error: No token provided"));
      }

      // Use hybrid verifyToken logic
      
      // Make middleware async IIFE wrapper or just handle promise
      verifyToken(token).then((result) => {
          if (!result.valid || !result.payload) {
             return next(new Error("Authentication error: Invalid or expired token"));
          }
          
          const userId = result.payload.sub;
          if (!userId) {
             return next(new Error("Authentication error: Invalid token payload"));
          }

          // Attach user info to socket
          socket.data.userId = userId;
          socket.data.user = result.payload;
          next();
      }).catch((err) => {
          console.error("WebSocket auth error:", err);
          next(new Error("Authentication error: Internal error"));
      });
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
