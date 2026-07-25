const multer = require("multer");

function multerErrorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File too large.",
                error: "Image must be 5MB or less."
            });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: "Unexpected file field.",
                error: "Only one image file is allowed."
            });
        }
        return res.status(400).json({
            success: false,
            message: "File upload error.",
            error: err.message
        });
    }

    if (err.message && err.message.includes("Only JPG, PNG and WEBP")) {
        return res.status(400).json({
            success: false,
            message: "Invalid file type.",
            error: "Only JPG, PNG, and WEBP images are allowed."
        });
    }

    next(err);
}

function notFoundHandler(req, res, next) {
    if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "Endpoint not found.",
            error: "The requested API endpoint does not exist."
        });
    }
    next();
}

function globalErrorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);

    if (err.name === "CastError" && err.kind === "ObjectId") {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format.",
            error: "The provided ID is not valid."
        });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {}).join(", ");
        return res.status(409).json({
            success: false,
            message: "Duplicate entry.",
            error: `A record with that ${field} already exists.`
        });
    }

    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map(function (e) { return e.message; });
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            error: messages.join(". ")
        });
    }

    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            success: false,
            message: "Invalid token.",
            error: "Authentication failed."
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            success: false,
            message: "Token expired.",
            error: "Your session has expired. Please log in again."
        });
    }

    const statusCode = err.statusCode || 500;
    const message = statusCode === 500
        ? "Internal server error."
        : err.message;

    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === "production"
            ? "An unexpected error occurred."
            : err.message
    });
}

module.exports = {
    multerErrorHandler,
    notFoundHandler,
    globalErrorHandler
};
