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

  // Security Middleware
  io.use((socket, next) => {
      const token = socket.handshake.query.token as string;
      // Also check headers for flexibility
      // const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
          return next(new Error("Authentication error: No token provided"));
      }

      try {
          // Verify JWT
          const secret = process.env.JWT_SECRET || "supersecret"; // Should import from @repo/config
          const decoded = jwt.verify(token, secret) as any;
          
          if (!decoded || !decoded.userId) {
              return next(new Error("Authentication error: Invalid token"));
          }
          
          // Attach user to socket
          socket.data.userId = decoded.userId;
          next();
      } catch (err) {
          next(new Error("Authentication error"));
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
