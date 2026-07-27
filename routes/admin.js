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

        var totalOrders = await Order.countDocuments();
        var pendingOrders = await Order.countDocuments({ status: "Pending" });
        var completedOrders = await Order.countDocuments({ status: "Completed" });
        var acceptedOrders = await Order.countDocuments({ status: "Accepted" });
        var rejectedOrders = await Order.countDocuments({ status: "Rejected" });
        var cancelledOrders = await Order.countDocuments({ status: "Cancelled" });

        var todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        var ordersToday = await Order.countDocuments({ createdAt: { $gte: todayStart } });

        var revenueResult = await Order.aggregate([
            { $match: { status: { $in: ["Completed", "Accepted"] } } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        var totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        var pendingRevenueResult = await Order.aggregate([
            { $match: { status: "Pending" } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        var pendingRevenue = pendingRevenueResult.length > 0 ? pendingRevenueResult[0].total : 0;

        var commissionRate = 0.02;
        var platformCommission = Math.round(totalRevenue * commissionRate);
        var farmerEarnings = totalRevenue - platformCommission;

        var categoriesCount = productsByCategory.length;

        var avgProductPrice = 0;
        if (totalProducts > 0) {
            var priceResult = await Product.aggregate([
                { $group: { _id: null, avg: { $avg: "$price" } } }
            ]);
            avgProductPrice = priceResult.length > 0 ? Math.round(priceResult[0].avg) : 0;
        }

        var outOfStockProducts = await Product.countDocuments({ quantity: 0 });
        var availableProducts = totalProducts - outOfStockProducts;

        var avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / (completedOrders + acceptedOrders || 1)) : 0;

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
                    usersByRole: usersByRole,
                    totalOrders: totalOrders,
                    pendingOrders: pendingOrders,
                    completedOrders: completedOrders,
                    acceptedOrders: acceptedOrders,
                    rejectedOrders: rejectedOrders,
                    cancelledOrders: cancelledOrders,
                    ordersToday: ordersToday,
                    totalRevenue: totalRevenue,
                    platformCommission: platformCommission,
                    farmerEarnings: farmerEarnings,
                    pendingRevenue: pendingRevenue,
                    categoriesCount: categoriesCount,
                    avgProductPrice: avgProductPrice,
                    outOfStockProducts: outOfStockProducts,
                    availableProducts: availableProducts,
                    avgOrderValue: avgOrderValue
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
            .sort({ createdAt: -1 })
            .limit(500);

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
            .sort({ createdAt: -1 })
            .limit(500);

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
ADMIN FINANCIAL DASHBOARD
==================================================
*/

router.get("/financial", requireAdmin, async function (req, res) {
    try {
        var Wallet = require("../models/Wallet");
        var PlatformWallet = require("../models/PlatformWallet");
        var WithdrawRequest = require("../models/WithdrawRequest");
        var WalletTransaction = require("../models/WalletTransaction");

        var platformWallet = await PlatformWallet.findOne({ isActive: true });
        if (!platformWallet) {
            platformWallet = { availableBalance: 0, pendingBalance: 0, totalCommissionEarned: 0, totalWithdrawn: 0 };
        }

        var totalPlatformBalance = platformWallet.availableBalance || 0;
        var totalCommissionEarned = platformWallet.totalCommissionEarned || 0;
        var totalPlatformWithdrawn = platformWallet.totalWithdrawn || 0;

        var farmerWallets = await Wallet.find();
        var totalFarmerBalance = 0;
        var totalFarmerEarned = 0;
        var totalFarmerWithdrawn = 0;
        var totalFarmersWithWallets = farmerWallets.length;

        for (var i = 0; i < farmerWallets.length; i++) {
            totalFarmerBalance += farmerWallets[i].availableBalance || 0;
            totalFarmerEarned += farmerWallets[i].totalEarned || 0;
            totalFarmerWithdrawn += farmerWallets[i].totalWithdrawn || 0;
        }

        var pendingWithdrawals = await WithdrawRequest.countDocuments({ status: "pending" });
        var approvedWithdrawals = await WithdrawRequest.countDocuments({ status: "approved" });
        var rejectedWithdrawals = await WithdrawRequest.countDocuments({ status: "rejected" });
        var completedWithdrawals = await WithdrawRequest.countDocuments({ status: "completed" });
        var totalWithdrawalRequests = await WithdrawRequest.countDocuments();

        var recentWithdrawals = await WithdrawRequest.find()
            .populate("farmerId", "name email")
            .sort({ createdAt: -1 })
            .limit(20);

        var recentTransactions = await WalletTransaction.find()
            .sort({ createdAt: -1 })
            .limit(30);

        var monthlyCommission = await WalletTransaction.aggregate([
            { $match: { type: "commission", createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
            { $group: { _id: { month: { $month: "$createdAt" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
            { $sort: { "_id.month": 1 } }
        ]);

        var monthlyData = [];
        for (var m = 1; m <= 12; m++) {
            var found = monthlyCommission.find(function (item) { return item._id.month === m; });
            monthlyData.push({
                _id: { year: new Date().getFullYear(), month: m },
                total: found ? found.total : 0,
                count: found ? found.count : 0
            });
        }

        res.json({
            success: true,
            data: {
                platformWallet: platformWallet,
                stats: {
                    totalPlatformBalance: totalPlatformBalance,
                    totalCommissionEarned: totalCommissionEarned,
                    totalPlatformWithdrawn: totalPlatformWithdrawn,
                    totalFarmerBalance: totalFarmerBalance,
                    totalFarmerEarned: totalFarmerEarned,
                    totalFarmerWithdrawn: totalFarmerWithdrawn,
                    totalFarmersWithWallets: totalFarmersWithWallets,
                    pendingWithdrawals: pendingWithdrawals,
                    approvedWithdrawals: approvedWithdrawals,
                    rejectedWithdrawals: rejectedWithdrawals,
                    completedWithdrawals: completedWithdrawals,
                    totalWithdrawalRequests: totalWithdrawalRequests
                },
                recentWithdrawals: recentWithdrawals,
                recentTransactions: recentTransactions,
                monthlyCommission: monthlyData
            }
        });
    } catch (err) {
        console.error("[Admin] Financial dashboard error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load financial data.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
ADMIN - GET WITHDRAWAL REQUESTS
==================================================
*/

router.get("/withdrawals", requireAdmin, async function (req, res) {
    try {
        var walletService = require("../services/walletService");
        var status = req.query.status || null;
        var requests = await walletService.getWithdrawRequests(null, status);
        res.json({
            success: true,
            data: requests
        });
    } catch (err) {
        console.error("[Admin] Withdrawals fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch withdrawals.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
ADMIN - APPROVE / REJECT WITHDRAWAL
==================================================
*/

router.put("/withdrawals/:requestId/approve", requireAdmin, async function (req, res) {
    try {
        var walletService = require("../services/walletService");
        var adminNote = req.body.adminNote || "";
        var request = await walletService.approveWithdrawal(req.params.requestId, req.user._id, adminNote);

        res.json({
            success: true,
            message: "Withdrawal approved.",
            data: request
        });
    } catch (err) {
        console.error("[Admin] Withdrawal approve error:", err.message);
        res.status(400).json({
            success: false,
            message: "Failed to approve withdrawal.",
            error: "An unexpected error occurred."
        });
    }
});

router.put("/withdrawals/:requestId/reject", requireAdmin, async function (req, res) {
    try {
        var walletService = require("../services/walletService");
        var adminNote = req.body.adminNote || "";
        var request = await walletService.rejectWithdrawal(req.params.requestId, req.user._id, adminNote);

        res.json({
            success: true,
            message: "Withdrawal rejected.",
            data: request
        });
    } catch (err) {
        console.error("[Admin] Withdrawal reject error:", err.message);
        res.status(400).json({
            success: false,
            message: "Failed to reject withdrawal.",
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
