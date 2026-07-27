const express = require("express");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/*
==================================================
GET /api/notifications - Get current user's notifications
==================================================
*/
router.get("/", requireAuth, async function (req, res) {
    try {
        var notifications = await Notification.find({ user: req.userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        var unreadCount = await Notification.countDocuments({
            user: req.userId,
            read: false
        });

        res.json({
            success: true,
            data: notifications,
            unreadCount: unreadCount
        });
    } catch (err) {
        console.error("[Notifications] Fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch notifications.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
GET /api/notifications/unread-count - Get unread count
==================================================
*/
router.get("/unread-count", requireAuth, async function (req, res) {
    try {
        var unreadCount = await Notification.countDocuments({
            user: req.userId,
            read: false
        });

        res.json({
            success: true,
            data: { unreadCount: unreadCount }
        });
    } catch (err) {
        console.error("[Notifications] Count error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch unread count.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
PATCH /api/notifications/:id/read - Mark one as read
==================================================
*/
router.patch("/:id/read", requireAuth, async function (req, res) {
    try {
        var notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found.",
                error: "The requested notification does not exist."
            });
        }

        res.json({ success: true, data: notification });
    } catch (err) {
        console.error("[Notifications] Mark read error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to mark notification as read.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
PATCH /api/notifications/read-all - Mark all as read
==================================================
*/
router.patch("/read-all", requireAuth, async function (req, res) {
    try {
        await Notification.updateMany(
            { user: req.userId, read: false },
            { read: true }
        );

        res.json({ success: true, message: "All notifications marked as read." });
    } catch (err) {
        console.error("[Notifications] Mark all read error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to mark all notifications as read.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
