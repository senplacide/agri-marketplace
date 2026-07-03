// routes/products.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const express = require("express");
const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const { validateProductInput } = require("../utils/validation");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
//
// Multer configuration
//
const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9);

        cb(
            null,
            uniqueName +
            path.extname(file.originalname)
        );

    }

});

const fileFilter = (req, file, cb) => {

    const allowedTypes =
        /jpeg|jpg|png|webp/;

    const isValid =
        allowedTypes.test(file.mimetype);

    if (isValid) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Only JPG, PNG and WEBP images are allowed."
            )
        );

    }

};

const upload = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }

});

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
router.post(
    "/",
    requireAuth,
    upload.single("image"),
    async (req, res) => {

        console.log("===== PRODUCT REQUEST =====");
        console.log("BODY:", req.body);
        console.log("FILE:", req.file);
        console.log("===========================");

        try {

            const productData = {
                ...req.body,
                owner: req.userId
            };

            if (req.file) {
                productData.imageUrl =
                    "/uploads/" + req.file.filename;
            }

            const validation =
                validateProductInput(productData);

            if (validation.error) {
                return res.status(400).json({
                    error: validation.error
                });
            }

            const product =
                new Product(validation.value);

            await product.save();

            res.status(201).json(product);

        } catch (err) {

            res.status(400).json({
                error: err.message
            });

        }

    }
);
// --- 4. UPDATE product (Protected - owner only) ---
router.put("/:id", requireAuth, upload.single("image"), async (req, res) => {
    try {

        console.log("===== UPDATE REQUEST =====");
        console.log("BODY:", req.body);
        console.log("FILE:", req.file);
        console.log("==========================");

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        if (product.owner.toString() !== req.userId) {
            return res.status(403).json({
                error: "Forbidden: You do not own this listing"
            });
        }

        const updateData = {
    ...req.body
};

if (req.file) {
    updateData.imageUrl = "/uploads/" + req.file.filename;
}

console.log("UPDATE DATA:", updateData);

const validation = validateProductInput(updateData, {
    partial: true
});

console.log("VALIDATION:", validation.value);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        const oldImage = product.imageUrl;

const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { ...validation.value },
    {
        new: true,
        runValidators: true
    }
);

// Delete old image if a new one was uploaded
if (
    req.file &&
    oldImage &&
    oldImage.startsWith("/uploads/")
) {
    const oldImagePath = path.join(
        __dirname,
        "..",
        oldImage
    );

    fs.unlink(oldImagePath, (err) => {
        if (err) {
            console.error(
                "Could not delete old image:",
                err.message
            );
        } else {
            console.log(
                "Old image deleted:",
                oldImage
            );
        }
    });
}

res.json(updatedProduct);

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
        
        // Delete image from uploads folder
if (
    product.imageUrl &&
    product.imageUrl.startsWith("/uploads/")
) {
    const imagePath = path.join(
        __dirname,
        "..",
        product.imageUrl
    );

    fs.unlink(imagePath, (err) => {
        if (err) {
            console.error(
                "Failed to delete image:",
                err.message
            );
        } else {
            console.log(
                "Deleted image:",
                product.imageUrl
            );
        }
    });
}

// Delete product from MongoDB
await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;