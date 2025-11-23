// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// NOTE: You must have JWT_SECRET and JWT_EXPIRES_IN set in your .env file
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Utility function to create a signed JWT
function createToken(user) {
    return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// --- 1. POST /signup ---
router.post("/signup", async (req, res) => {
    try {
        const { name = "", email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: "Email already registered" });

        const passwordHash = await bcrypt.hash(password, 10);
        const user = new User({ name, email, passwordHash });
        await user.save();

        // Optionally sign in the user immediately after signup
        const token = createToken(user);
        // User object returned does NOT contain passwordHash due to the toJSON method
        res.status(201).json({ token, user }); 
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. POST /signin ---
router.post("/login", async (req, res) => { // Using /login to match standard conventions, although client-side may use /signin
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        const token = createToken(user);
        res.json({ token, user }); 
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. GET /me (Verify token and get user data) ---
router.get("/me", async (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ error: "Unauthorized: Missing token" });
        const token = auth.split(" ")[1];
        
        const decoded = jwt.verify(token, JWT_SECRET);
        // Find user by ID from token payload, excluding the password hash
        const user = await User.findById(decoded.id).select("-passwordHash"); 
        
        if (!user) return res.status(404).json({ error: "User not found" });
        
        res.json(user); // Return the user object (JSON method already removed passwordHash)
    } catch (err) {
        console.error("Token verification failed:", err.message);
        res.status(401).json({ error: "Invalid or expired token" });
    }
});

module.exports = router;