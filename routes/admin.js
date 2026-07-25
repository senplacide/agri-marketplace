const express = require("express");
const requireAdmin = require("../middleware/admin");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AuditLog = require("../models/AuditLog");
const { sendProductApprovedEmail, sendProductRejectedEmail } = require("../utils/email");
const { validateObjectId, validateStatusInput, USER_ROLES } = require("../utils/validation");

const router = express.Router();

/*
==================================================
ADMIN DASHBOARD
==================================================
*/

router.get("/dashboard", requireAdmin, async function (req, res) {
    try {
        var totalUsers = await User.countDocuments();
        var totalProducts = await Product.countDocuments();
        var farmers = await User.countDocuments({ role: "farmer" });
        var buyers = await User.countDocuments({ role: "buyer" });
        var admins = await User.countDocuments({ role: "admin" });
        var usersByRole = { farmers: farmers, buyers: buyers, admins: admins };

        var verifiedUsers = await User.countDocuments({ isVerified: true });
        var unverifiedUsers = await User.countDocuments({ isVerified: false });
        var pendingProducts = await Product.countDocuments({ status: "pending" });
        var approvedProducts = await Product.countDocuments({ status: "approved" });
        var rejectedProducts = await Product.countDocuments({ status: "rejected" });

        var productsByCategory = await Product.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        var rawProductsPerMonth = await Product.aggregate([
            { $group: { _id: { month: { $month: "$createdAt" } }, count: { $sum: 1 } } }
        ]);

        var productsPerMonth = [];
        for (var month = 1; month <= 12; month++) {
            var found = rawProductsPerMonth.find(function (item) { return item._id.month === month; });
            productsPerMonth.push({
                _id: { year: new Date().getFullYear(), month: month },
                count: found ? found.count : 0
            });
        }

        var rawUsersPerMonth = await User.aggregate([
            { $group: { _id: { month: { $month: "$createdAt" } }, count: { $sum: 1 } } }
        ]);

        var usersPerMonth = [];
        for (var m = 1; m <= 12; m++) {
            var foundUser = rawUsersPerMonth.find(function (item) { return item._id.month === m; });
            usersPerMonth.push({
                _id: { year: new Date().getFullYear(), month: m },
                count: foundUser ? foundUser.count : 0
            });
        }

        var users = await User.find()
            .select("-passwordHash -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordExpires")
            .sort({ createdAt: -1 });

        var products = await Product.find().populate("owner", "name email");

        res.json({
            success: true,
            data: {
                admin: {
                    id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    role: req.user.role
                },
                stats: {
                    totalUsers: totalUsers,
                    totalProducts: totalProducts,
                    pendingProducts: pendingProducts,
                    approvedProducts: approvedProducts,
                    rejectedProducts: rejectedProducts,
                    farmers: farmers,
                    buyers: buyers,
                    admins: admins,
                    verifiedUsers: verifiedUsers,
                    unverifiedUsers: unverifiedUsers,
                    usersByRole: usersByRole
                },
                users: users,
                products: products,
                productsPerMonth: productsPerMonth,
                usersPerMonth: usersPerMonth,
                productsByCategory: productsByCategory
            }
        });
    } catch (err) {
        console.error("[Admin] Dashboard error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
GET ALL USERS
==================================================
*/

router.get("/users", requireAdmin, async function (req, res) {
    try {
        var users = await User.find()
            .select("-passwordHash -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordExpires")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: users
        });
    } catch (err) {
        console.error("[Admin] Users fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch users.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
GET ALL PRODUCTS
==================================================
*/

router.get("/products", requireAdmin, async function (req, res) {
    try {
        var products = await Product.find()
            .populate("owner", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: products
        });
    } catch (err) {
        console.error("[Admin] Products fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
UPDATE USER ROLE
==================================================
*/

router.put("/users/:id", requireAdmin, async function (req, res) {
    try {
        var idCheck = validateObjectId(req.params.id, "user ID");
        if (idCheck.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: idCheck.error
            });
        }

        if (req.user._id.equals(req.params.id)) {
            return res.status(403).json({
                success: false,
                message: "Action denied.",
                error: "You cannot change your own role."
            });
        }

        var role = req.body && req.body.role;
        if (!USER_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Invalid role. Must be one of: " + USER_ROLES.join(", ")
            });
        }

        var user = await User.findByIdAndUpdate(
            req.params.id,
            { role: role },
            { new: true }
        ).select("-passwordHash -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordExpires");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "The requested user does not exist."
            });
        }

        res.json({
            success: true,
            message: "User role updated.",
            data: user
        });
    } catch (err) {
        console.error("[Admin] Update user role error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update user role.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
SUSPEND / UNSUSPEND USER
==================================================
*/

router.put("/users/:id/suspend", requireAdmin, async function (req, res) {
    try {
        var idCheck = validateObjectId(req.params.id, "user ID");
        if (idCheck.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: idCheck.error
            });
        }

        var user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "The requested user does not exist."
            });
        }

        if (user._id.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "Action denied.",
                error: "You cannot suspend or activate your own account."
            });
        }

        user.isSuspended = !user.isSuspended;
        await user.save();

        res.json({
            success: true,
            message: user.isSuspended ? "User suspended." : "User activated.",
            data: { isSuspended: user.isSuspended }
        });
    } catch (err) {
        console.error("[Admin] Suspend user error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update user status.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
DELETE USER
==================================================
*/

router.delete("/users/:id", requireAdmin, async function (req, res) {
    try {
        var idCheck = validateObjectId(req.params.id, "user ID");
        if (idCheck.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: idCheck.error
            });
        }

        if (req.user._id.equals(req.params.id)) {
            return res.status(403).json({
                success: false,
                message: "Action denied.",
                error: "You cannot delete your own account."
            });
        }

        var user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "The requested user does not exist."
            });
        }

        await user.deleteOne();

        res.json({
            success: true,
            message: "User deleted successfully."
        });
    } catch (err) {
        console.error("[Admin] Delete user error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to delete user.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
DELETE PRODUCT
==================================================
*/

router.delete("/products/:id", requireAdmin, async function (req, res) {
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

        await product.deleteOne();

        res.json({
            success: true,
            message: "Product deleted successfully."
        });
    } catch (err) {
        console.error("[Admin] Delete product error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to delete product.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
APPROVE / REJECT PRODUCT
==================================================
*/

router.put("/products/:id/status", requireAdmin, async function (req, res) {
    try {
        var idCheck = validateObjectId(req.params.id, "product ID");
        if (idCheck.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: idCheck.error
            });
        }

        var statusValidation = validateStatusInput(req.body, ["approved", "rejected", "pending"]);
        if (statusValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: statusValidation.error
            });
        }

        var product = await Product.findById(req.params.id).populate("owner", "name email");

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
                error: "The requested product does not exist."
            });
        }

        var previousStatus = product.status;
        product.status = statusValidation.value.status;
        await product.save();

        if (product.status !== previousStatus && product.owner && product.owner.email) {
            try {
                if (product.status === "approved") {
                    await sendProductApprovedEmail(product.owner.email, product.owner.name, product.name);
                } else if (product.status === "rejected") {
                    await sendProductRejectedEmail(product.owner.email, product.owner.name, product.name, req.body.reason || "");
                }
            } catch (emailErr) {
                console.error("[Admin] Product status email failed:", emailErr.message);
            }
        }

        res.json({
            success: true,
            message: "Product status updated.",
            data: product
        });
    } catch (err) {
        console.error("[Admin] Product status error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update product status.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
GET ALL ORDERS (ADMIN)
==================================================
*/

router.get("/orders", requireAdmin, async function (req, res) {
    try {
        var orders = await Order.find()
            .populate("buyer", "name email phone")
            .sort({ createdAt: -1 });

        var result = orders.map(function (order) {
            return order.toObject();
        });

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error("[Admin] Orders fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
AUDIT LOGS
==================================================
*/

router.get("/audit-logs", requireAdmin, async function (req, res) {
    try {
        var logs = await AuditLog.find()
            .sort({ createdAt: -1 })
            .limit(500);
        res.json({
            success: true,
            data: logs
        });
    } catch (err) {
        console.error("[Admin] Audit logs fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch audit logs.",
            error: "An unexpected error occurred."
        });
    }
});

router.post("/audit-logs", requireAdmin, async function (req, res) {
    try {
        var action = req.body && req.body.action;
        var target = req.body && req.body.target;
        var details = req.body && req.body.details;

        if (!action || typeof action !== "string" || !action.trim()) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Action is required."
            });
        }

        if (!target || typeof target !== "string" || !target.trim()) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Target is required."
            });
        }

        var log = await AuditLog.create({
            action: action.trim().substring(0, 500),
            target: target.trim().substring(0, 500),
            admin: req.user.name || req.user.email,
            details: details ? String(details).substring(0, 2000) : ""
        });

        res.status(201).json({
            success: true,
            message: "Audit log created.",
            data: log
        });
    } catch (err) {
        console.error("[Admin] Audit log create error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to create audit log.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
