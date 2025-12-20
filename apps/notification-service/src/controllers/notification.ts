import { Request, Response } from "express";
import { prisma } from "@repo/database";

export const getNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 20
        });
        
        // Count unread (using readAt for consistency with web API)
        const unreadCount = await prisma.notification.count({
            where: { userId, readAt: null }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Get Notifs Error:", error);
        res.status(500).json({ error: "Internal Error" });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.sub;
    
    try {
        await prisma.notification.updateMany({
            where: { id, userId }, // Security check: must own it
            data: { readAt: new Date() }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Mark As Read Error:", error);
        res.status(500).json({ error: "Internal Error" });
    }
};

export const markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    try {
        await prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Mark All Read Error:", error);
        res.status(500).json({ error: "Internal Error" });
    }
};
