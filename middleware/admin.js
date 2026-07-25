const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("[Admin Middleware] FATAL: JWT_SECRET is not set in environment variables.");
    process.exit(1);
}

async function requireAdmin(req, res, next) {
    try {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
                error: "No token provided."
            });
        }

        var token = authHeader.split(" ")[1];
        var decoded = jwt.verify(token, JWT_SECRET);

        var user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found.",
                error: "User account no longer exists."
            });
        }

        if (user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: "Account suspended.",
                error: "Your account has been suspended."
            });
        }

        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Forbidden.",
                error: "Admin access only."
            });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token expired.",
                error: "Your session has expired. Please log in again."
            });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid token.",
                error: "Authentication failed."
            });
        }
        console.error("[Admin Middleware] Error:", err.message);
        return res.status(401).json({
            success: false,
            message: "Authentication failed.",
            error: "Invalid or expired token."
        });
    }
}

module.exports = requireAdmin;
