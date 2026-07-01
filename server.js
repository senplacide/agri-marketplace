const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");

// Load environment variables
dotenv.config();

const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'none'"],
            connectSrc: ["'self'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"]
        }
    }
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// --- Database Connection ---
if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI missing in .env");
    process.exit(1);
}

mongoose.set("strictQuery", false);

const maskMongoUri = (uri) => {
    if (!uri) return "<missing>";
    try {
        const parsed = new URL(uri);
        if (parsed.password) {
            parsed.password = "***";
        }
        return parsed.toString();
    } catch (err) {
        return uri.replace(/:([^:@]+)@/, ":***@");
    }
};

console.log(`[DB_DEBUG] Mongo URI: ${maskMongoUri(process.env.MONGO_URI)}`);
mongoose
    .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10
    })
    .then(() => {
        console.log("✅ MongoDB connected");
        console.log(`[DB_DEBUG] database name: ${mongoose.connection.name}`);
    })
    .catch((err) => console.error("❌ MongoDB connection failed:", err.message));

// --- API Routes ---
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/contact", require("./routes/contact"));

// Health check for Render
app.get("/health", (req, res) => res.status(200).send("OK"));

// --- Serve static frontend ---
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "about.html"));
});

app.get("/contact", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "contact.html"));
});

app.get("/items", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "items.html"));
});

app.get("/auth", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "auth.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/verify", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "verify.html"));
});

// --- Start server ---
const PORT = process.env.PORT || 5000;

console.log("Render PORT =", process.env.PORT);

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

module.exports = app;
