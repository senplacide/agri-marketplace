// routes/products.js
const express = require("express");
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// --- Middleware: Authentication ---
function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id; // Attach the user ID to the request object
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        res.status(401).json({ error: "Invalid or expired token" });
    }
}

// --- 1. GET all products (Public) ---
router.get("/", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).populate("owner", "name email");
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. GET user's products (Protected for Dashboard) ---
router.get("/my-listings", requireAuth, async (req, res) => {
    try {
        const products = await Product.find({ owner: req.userId }).sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user listings." });
    }
});

// --- 3. POST create product (Protected) ---
router.post("/", requireAuth, async (req, res) => {
    try {
        const data = req.body;
        data.owner = req.userId; 
        const p = new Product(data);
        await p.save(); // Mongoose will validate paymentMethods here
        res.status(201).json(p);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- 4. DELETE product (Protected - owner only) ---
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });
        
        if (product.owner && product.owner.toString() !== req.userId) {
            return res.status(403).json({ error: "Forbidden: You do not own this listing" });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;