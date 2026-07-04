// routes/products.js

const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");
const Product = require("../models/Product");
const { validateProductInput } = require("../utils/validation");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

/* ============================================================
   CLOUDINARY STORAGE
============================================================ */

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: "agriconnect-products",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        public_id:
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9)
    })
});

const fileFilter = (req, file, cb) => {

    const allowedTypes = /jpeg|jpg|png|webp/;

    if (
        allowedTypes.test(file.mimetype)
    ) {
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
        fileSize: 5 * 1024 * 1024
    }

});

/* ============================================================
   AUTH MIDDLEWARE
============================================================ */

function requireAuth(req, res, next) {

    try {

        const auth =
            req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                error:
                    "Unauthorized: Missing Authorization header"
            });
        }

        const token =
            auth.split(" ")[1];

        const decoded =
            jwt.verify(token, JWT_SECRET);

        req.userId = decoded.id;

        next();

    } catch (err) {

        console.error(
            "Auth Error:",
            err.message
        );

        return res.status(401).json({
            error:
                "Invalid or expired token"
        });

    }

}

/* ============================================================
   GET ALL PRODUCTS
============================================================ */

router.get("/", async (req, res) => {

    try {

        const products =
            await Product.find()
                .sort({ createdAt: -1 })
                .populate(
                    "owner",
                    "name email"
                );

        res.json(products);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

/* ============================================================
   GET MY PRODUCTS
============================================================ */

router.get(
    "/my-listings",
    requireAuth,
    async (req, res) => {

        try {

            const products =
                await Product.find({
                    owner: req.userId
                }).sort({
                    createdAt: -1
                });

            res.json(products);

        } catch (err) {

            res.status(500).json({
                error:
                    "Failed to fetch user listings."
            });

        }

    }
);

/* ============================================================
   CREATE PRODUCT
============================================================ */

router.post(
    "/",
    requireAuth,
    upload.single("image"),
    async (req, res) => {

        try {

            const productData = {

                ...req.body,

                owner: req.userId

            };

            if (req.file) {

                productData.imageUrl =
                    req.file.path;

                productData.cloudinaryId =
                    req.file.filename;

            }

            const validation =
                validateProductInput(
                    productData
                );

            if (validation.error) {

                return res.status(400).json({
                    error:
                        validation.error
                });

            }

            const product =
                new Product(
                    validation.value
                );

            await product.save();

            res.status(201).json(product);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    err.message ||
                    "Failed to create product."
            });

        }

    }
);

/* ============================================================
   UPDATE PRODUCT
============================================================ */

router.put(
    "/:id",
    requireAuth,
    upload.single("image"),
    async (req, res) => {

        try {

            const product =
                await Product.findById(
                    req.params.id
                );

            if (!product) {
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            if (
                !product.owner.equals(req.userId)
            ) {
                return res.status(403).json({
                    error:
                        "Forbidden: You do not own this listing"
                });
            }

            const updateData = {
                ...req.body
            };

            if (req.file) {

                updateData.imageUrl =
                    req.file.path;

                updateData.cloudinaryId =
                    req.file.filename;

            }

            const validation =
                validateProductInput(
                    updateData,
                    { partial: true }
                );

            if (validation.error) {
                return res.status(400).json({
                    error:
                        validation.error
                });
            }

            /*
             Delete previous Cloudinary image
             only AFTER new upload succeeded.
            */

            if (
                req.file &&
                product.cloudinaryId
            ) {

                try {

                    await cloudinary.uploader.destroy(
                        product.cloudinaryId
                    );

                } catch (cloudinaryError) {

                    console.error(
                        "Cloudinary delete failed:",
                        cloudinaryError.message
                    );

                }

            }

            const updatedProduct =
                await Product.findByIdAndUpdate(

                    req.params.id,

                    validation.value,

                    {
                        new: true,
                        runValidators: true
                    }

                );

            res.json(updatedProduct);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    err.message ||
                    "Failed to update product."
            });

        }

    }
);

/* ============================================================
   DELETE PRODUCT
============================================================ */

router.delete(
    "/:id",
    requireAuth,
    async (req, res) => {

        try {

            const product =
                await Product.findById(
                    req.params.id
                );

            if (!product) {
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            if (
                !product.owner.equals(req.userId)
            ) {
                return res.status(403).json({
                    error:
                        "Forbidden: You do not own this listing"
                });
            }

            if (
                product.cloudinaryId
            ) {

                try {

                    await cloudinary.uploader.destroy(
                        product.cloudinaryId
                    );

                } catch (cloudinaryError) {

                    console.error(
                        "Cloudinary delete failed:",
                        cloudinaryError.message
                    );

                }

            }

            await Product.findByIdAndDelete(
                req.params.id
            );

            res.json({
                message:
                    "Product deleted successfully."
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    err.message ||
                    "Failed to delete product."
            });

        }

    }
);

module.exports = router;