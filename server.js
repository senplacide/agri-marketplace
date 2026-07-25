const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");

dotenv.config();

const { globalLimiter } = require("./middleware/rateLimiter");
const { multerErrorHandler, notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");

const app = express();

// --- Security Headers ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            connectSrc: ["'self'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// --- CORS ---
const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5000",
    "http://localhost:3000"
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400
}));

// --- Body Parsing ---
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// --- MongoDB Injection Protection ---
app.use(mongoSanitize({
    replaceWith: "_",
    onSanitize: function (req, key) {
        console.warn(`[Security] Sanitized key "${key}" in ${req.method} ${req.originalUrl}`);
    }
}));

// --- Request Logging ---
if (process.env.NODE_ENV !== "test") {
    app.use(morgan("combined", {
        skip: function (req) { return req.url === "/health"; }
    }));
}

// --- Global Rate Limiting ---
app.use("/api", globalLimiter);

// --- MongoDB Readiness Guard ---
app.use("/api", function (req, res, next) {
    if (process.env.NODE_ENV !== "test" && mongoose.connection.readyState !== 1) {
        var states = ["disconnected", "connected", "connecting", "disconnecting"];
        var currentState = states[mongoose.connection.readyState] || "unknown";
        console.warn(`[MongoDB] Rejected request to ${req.method} ${req.originalUrl} - connection state: ${currentState}`);
        return res.status(503).json({
            success: false,
            message: "Service unavailable.",
            error: "Database connection is not established."
        });
    }
    next();
});

// --- Database Connection ---
if (!process.env.MONGO_URI) {
    console.error("[Server] FATAL ERROR: MONGO_URI missing in .env");
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error("[Server] FATAL ERROR: JWT_SECRET missing in .env");
    process.exit(1);
}

mongoose.set("strictQuery", false);
mongoose.set("bufferCommands", false);

var maskMongoUri = function (uri) {
    if (!uri) return "<missing>";
    try {
        var parsed = new URL(uri);
        if (parsed.password) {
            parsed.password = "***";
        }
        return parsed.toString();
    } catch (err) {
        return uri.replace(/:([^:@]+)@/, ":***@");
    }
};

var MONGO_URI = process.env.MONGO_URI;
var RETRY_DELAY_MS = 5000;
var MAX_RETRIES = 5;

async function connectWithRetry(attempt) {
    attempt = attempt || 1;
    console.log("[MongoDB] Connecting... (attempt " + attempt + "/" + MAX_RETRIES + ")");
    console.log("[MongoDB] URI: " + maskMongoUri(MONGO_URI));

    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            maxPoolSize: 10,
            minPoolSize: 1,
            socketTimeoutMS: 45000,
        });
    } catch (err) {
        console.error("[MongoDB] Connection attempt " + attempt + " failed: " + err.message);
        if (attempt < MAX_RETRIES) {
            console.log("[MongoDB] Retrying in " + (RETRY_DELAY_MS / 1000) + "s...");
            await new Promise(function (r) { setTimeout(r, RETRY_DELAY_MS); });
            return connectWithRetry(attempt + 1);
        }
        throw err;
    }
}

mongoose.connection.on("connected", function () {
    console.log("[MongoDB] Connected successfully.");
    console.log("[MongoDB] Database: " + mongoose.connection.name);
    console.log("[MongoDB] Host: " + mongoose.connection.host);
});

mongoose.connection.on("disconnected", function () {
    console.warn("[MongoDB] Disconnected. MongoDB is unreachable.");
});

mongoose.connection.on("reconnecting", function () {
    console.warn("[MongoDB] Attempting reconnect...");
});

mongoose.connection.on("reconnected", function () {
    console.log("[MongoDB] Reconnected successfully.");
});

mongoose.connection.on("error", function (err) {
    console.error("[MongoDB] Connection error: " + err.message);
});

process.on("SIGINT", async function () {
    console.log("\n[MongoDB] Closing connection...");
    await mongoose.connection.close();
    console.log("[MongoDB] Connection closed.");
    process.exit(0);
});

process.on("SIGTERM", async function () {
    console.log("\n[MongoDB] Closing connection...");
    await mongoose.connection.close();
    console.log("[MongoDB] Connection closed.");
    process.exit(0);
});

// --- API Routes ---
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/farmer", require("./routes/farmer"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/analytics", require("./routes/analytics"));

// --- Health Check ---
app.get("/health", function (req, res) {
    res.status(200).send("OK");
});

// --- Serve Static Frontend ---
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/about", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "about.html"));
});
app.get("/contact", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "contact.html"));
});
app.get("/items", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "items.html"));
});
app.get("/auth", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "auth.html"));
});
app.get("/dashboard", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
app.get("/buyer-dashboard", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "buyer-dashboard.html"));
});
app.get("/checkout", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "checkout.html"));
});
app.get("/orders", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "orders.html"));
});
app.get("/farmer-orders", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "farmer-orders.html"));
});
app.get("/verify", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "verify.html"));
});
app.get("/profile", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "profile.html"));
});

// --- Error Handling (must be after routes) ---
app.use(multerErrorHandler);
app.use(notFoundHandler);
app.use(globalErrorHandler);

// --- Start Server ---
var PORT = process.env.PORT || 5000;

if (require.main === module) {
    (async function () {
        try {
            console.log("[Server] Starting up...");
            console.log("[Server] NODE_ENV=" + (process.env.NODE_ENV || "(not set)"));
            console.log("[Server] PORT=" + PORT);
            await connectWithRetry();
            app.listen(PORT, "0.0.0.0", function () {
                console.log("[Server] Running on port " + PORT);
                console.log("[Server] MongoDB readyState: " + mongoose.connection.readyState + " (1=connected)");
            });
        } catch (err) {
            console.error("[Server] Failed to start: could not connect to MongoDB after " + MAX_RETRIES + " attempts.");
            console.error("[Server] Last error: " + err.message);
            process.exit(1);
        }
    })();
}

module.exports = app;
