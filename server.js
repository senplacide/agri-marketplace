// server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in the .env file.");
    process.exit(1); 
}

mongoose.set("strictQuery", false);
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection failed:", err.message));

// --- Routes ---
// The following files MUST be in the ./routes folder:
const authRouter = require("./routes/auth");
const productRouter = require("./routes/products");
const contactRouter = require("./routes/contact"); 

// API routes mapping
app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/contact", contactRouter); 

// --- Frontend Serving ---
app.use(express.static(path.join(__dirname, "public")));

// Explicit page routes (serving HTML files)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/items", (req, res) => res.sendFile(path.join(__dirname, "public", "items.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "about.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "public", "contact.html")));
app.get("/auth", (req, res) => res.sendFile(path.join(__dirname, "public", "auth.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// Fallback 404
app.use("/api", (req,res) => res.status(404).json({ error: "API route not found" }));
app.use((req,res) => res.status(404).sendFile(path.join(__dirname, "public", "404.html"))); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));