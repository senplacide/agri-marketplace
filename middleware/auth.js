const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("[Auth Middleware] FATAL: JWT_SECRET is not set in environment variables.");
    process.exit(1);
}

function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
                error: "No token provided."
            });
        }

        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        User.findById(decoded.id).select("isSuspended")
            .then(function (user) {
                if (user && user.isSuspended) {
                    return res.status(403).json({
                        success: false,
                        message: "Account suspended.",
                        error: "Your account has been suspended."
                    });
                }
                req.userId = decoded.id;
                next();
            })
            .catch(function () {
                req.userId = decoded.id;
                next();
            });
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
        return res.status(401).json({
            success: false,
            message: "Authentication failed.",
            error: "Invalid or expired token."
        });
    }
}

function requireAuthWithUser(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
                error: "No token provided."
            });
        }

        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        User.findById(decoded.id)
            .then(function (user) {
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
                req.user = user;
                req.userId = decoded.id;
                next();
            })
            .catch(function (err) {
                console.error("[Auth] Database lookup error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Authentication failed.",
                    error: "Internal server error."
                });
            });
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
        return res.status(401).json({
            success: false,
            message: "Authentication failed.",
            error: "Invalid or expired token."
        });
    }
}

module.exports = { requireAuth, requireAuthWithUser, JWT_SECRET };
