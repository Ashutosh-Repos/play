import { Request, Response } from "express";
import { prisma } from "@repo/database/client";

export const getNotifications = async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 20
        });
        
        // Count unread
        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Get Notifs Error", error);
        res.status(500).json({ error: "Internal Error" });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] as string;
    
    try {
        await prisma.notification.updateMany({
            where: { id, userId }, // Security check: must own it
            data: { isRead: true, readAt: new Date() }
        });
        res.json({ success: true });
    } catch (error) {
         res.status(500).json({ error: "Internal Error" });
    }
};

export const markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;

    try {
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() }
        });
        res.json({ success: true });
    } catch (error) {
         res.status(500).json({ error: "Internal Error" });
    }
};
