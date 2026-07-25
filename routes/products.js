const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const Product = require("../models/Product");
const User = require("../models/User");
const { validateProductInput, validateObjectId } = require("../utils/validation");
const requireAdmin = require("../middleware/admin");
const { requireAuth } = require("../middleware/auth");
const { sendAdminNewProductEmail } = require("../utils/email");

const router = express.Router();

/* ============================================================
   CLOUDINARY STORAGE
============================================================ */

var storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async function (req, file) {
        return {
            folder: "agriconnect-products",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            public_id: Date.now() + "-" + Math.round(Math.random() * 1e9)
        };
    }
});

var fileFilter = function (req, file, cb) {
    var allowedTypes = /jpeg|jpg|png|webp/;
    if (allowedTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
    }
};

var upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/* ============================================================
   GET ALL PRODUCTS
============================================================ */

router.get("/", async function (req, res) {
    try {
        var products = await Product.find({ status: "approved" })
            .sort({ createdAt: -1 })
            .populate("owner", "name email");

        res.json({
            success: true,
            data: products
        });
    } catch (err) {
        console.error("[Products] Fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products.",
            error: "An unexpected error occurred."
        });
    }
});

/* ============================================================
   GET MY PRODUCTS
============================================================ */

router.get("/my-listings", requireAuth, async function (req, res) {
    try {
        var products = await Product.find({ owner: req.userId })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: products
        });
    } catch (err) {
        console.error("[Products] Fetch listings error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch listings.",
            error: "An unexpected error occurred."
        });
    }
});

/* ============================================================
   CREATE PRODUCT
============================================================ */

router.post("/", requireAuth, upload.single("image"), async function (req, res) {
    try {
        var productData = Object.assign({}, req.body, { owner: req.userId });

        if (req.file) {
            productData.imageUrl = req.file.path;
            productData.cloudinaryId = req.file.filename;
        }

        var validation = validateProductInput(productData);

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: validation.error
            });
        }

        var product = new Product(Object.assign({}, validation.value, { status: "pending" }));
        await product.save();

        try {
            var admins = await User.find({ role: "admin" }).select("email");
            var farmer = await User.findById(req.userId).select("name");
            for (var i = 0; i < admins.length; i++) {
                await sendAdminNewProductEmail(admins[i].email, product, farmer ? farmer.name : "Unknown Farmer");
            }
        } catch (emailErr) {
            console.error("[Products] Admin notification failed:", emailErr.message);
        }

        res.status(201).json({
            success: true,
            message: "Product created successfully.",
            data: product
        });
    } catch (err) {
        console.error("[Products] Create error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to create product.",
            error: "An unexpected error occurred."
        });
    }
});

/* ============================================================
   UPDATE PRODUCT
============================================================ */

router.put("/:id", requireAuth, upload.single("image"), async function (req, res) {
    try {
        var idCheck = validateObjectId(req.params.id, "product ID");
        if (idCheck.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: idCheck.error
            });
        }

        var product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
                error: "The requested product does not exist."
            });
        }

        if (!product.owner.equals(req.userId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden.",
                error: "You do not own this listing."
            });
        }

        var updateData = Object.assign({}, req.body);

        if (req.file) {
            updateData.imageUrl = req.file.path;
            updateData.cloudinaryId = req.file.filename;
        }

        var validation = validateProductInput(updateData, { partial: true });

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: validation.error
            });
        }

        if (req.file && product.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(product.cloudinaryId);
            } catch (cloudinaryError) {
                console.error("[Products] Cloudinary delete failed:", cloudinaryError.message);
            }
        }

        var updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            validation.value,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: "Product updated successfully.",
            data: updatedProduct
        });
    } catch (err) {
        console.error("[Products] Update error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update product.",
            error: "An unexpected error occurred."
        });
    }
});

/* ============================================================
   DELETE PRODUCT
============================================================ */

router.delete("/:id", requireAuth, async function (req, res) {
    try {
        var idCheck = validateObjectId(req.params.id, "product ID");
        if (idCheck.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: idCheck.error
            });
        }

        var product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
                error: "The requested product does not exist."
            });
        }

        if (!product.owner.equals(req.userId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden.",
                error: "You do not own this listing."
            });
        }

        if (product.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(product.cloudinaryId);
            } catch (cloudinaryError) {
                console.error("[Products] Cloudinary delete failed:", cloudinaryError.message);
            }
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Product deleted successfully."
        });
    } catch (err) {
        console.error("[Products] Delete error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to delete product.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
