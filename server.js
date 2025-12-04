const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI missing in .env");
    process.exit(1);
}

mongoose.set("strictQuery", false);
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection failed:", err.message));

// --- API Routes ---
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/contact", require("./routes/contact"));

// Health check for Render
app.get("/health", (req, res) => res.status(200).send("OK"));

// --- Serve static frontend ---
app.use(express.static(path.join(__dirname, "public")));

// SPA fallback (important for Render)
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
    console.log(`🚀 Server running on port ${PORT}`)
);
