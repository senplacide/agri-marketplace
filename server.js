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

// --- Start server ---
const PORT = process.env.PORT || 5000;

console.log("Render PORT =", process.env.PORT);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
