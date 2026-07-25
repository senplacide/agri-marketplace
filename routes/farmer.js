const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { sendOrderAcceptedEmail, sendOrderRejectedEmail, sendOrderCompletedEmail } = require("../utils/email");
const { requireAuth } = require("../middleware/auth");
const { validateStatusInput, validateObjectId, FARMER_ORDER_STATUSES } = require("../utils/validation");

const router = express.Router();

/*
==================================================
FARMER DASHBOARD
==================================================
*/

router.get("/dashboard", requireAuth, async function (req, res) {
    try {
        var user = await User.findById(req.userId).select("name email");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "User account no longer exists."
            });
        }

        var products = await Product.find({ owner: req.userId })
            .populate("owner", "name email")
            .sort({ createdAt: -1 });

        var totalProducts = await Product.countDocuments({ owner: req.userId });
        var approvedProducts = await Product.countDocuments({ owner: req.userId, status: "approved" });
        var pendingProducts = await Product.countDocuments({ owner: req.userId, status: "pending" });
        var rejectedProducts = await Product.countDocuments({ owner: req.userId, status: "rejected" });

        var productsByCategory = await Product.aggregate([
            { $match: { owner: user._id } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        var rawProductsPerMonth = await Product.aggregate([
            { $match: { owner: user._id } },
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

        res.json({
            success: true,
            data: {
                farmer: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                },
                stats: {
                    totalProducts: totalProducts,
                    approvedProducts: approvedProducts,
                    pendingProducts: pendingProducts,
                    rejectedProducts: rejectedProducts
                },
                products: products,
                productsPerMonth: productsPerMonth,
                productsByCategory: productsByCategory
            }
        });
    } catch (err) {
        console.error("[Farmer] Dashboard error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
FARMER ORDERS - Get orders for farmer's products
==================================================
*/

router.get("/orders", requireAuth, async function (req, res) {
    try {
        var farmerId = req.userId;

        var farmerProducts = await Product.find({ owner: farmerId }).select("_id");
        var productIds = farmerProducts.map(function (p) { return p._id; });

        if (productIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        var orders = await Order.find({ "items.product": { $in: productIds } })
            .populate("buyer", "name email phone")
            .sort({ createdAt: -1 });

        var result = orders.map(function (order) {
            var orderObj = order.toObject();

            var farmerItems = orderObj.items.filter(function (item) {
                return productIds.some(function (pid) {
                    return pid.toString() === item.product.toString();
                });
            });

            orderObj.items = farmerItems;
            orderObj.buyerName = orderObj.buyer ? orderObj.buyer.name : "Unknown";
            orderObj.buyerEmail = orderObj.buyer ? orderObj.buyer.email : "";
            orderObj.buyerPhone = orderObj.buyer
                ? orderObj.buyer.phone
                : (orderObj.deliveryInfo ? orderObj.deliveryInfo.phone : "");

            return orderObj;
        });

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error("[Farmer] Orders fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
FARMER ORDERS - Update order status
==================================================
*/

router.patch("/orders/:orderId/status", requireAuth, async function (req, res) {
    try {
        var statusValidation = validateStatusInput(req.body, FARMER_ORDER_STATUSES);
        if (statusValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: statusValidation.error
            });
        }

        var newStatus = statusValidation.value.status;
        var farmerId = req.userId;

        var order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
                error: "The requested order does not exist."
            });
        }

        var farmerProducts = await Product.find({ owner: farmerId }).select("_id");
        var productIds = farmerProducts.map(function (p) { return p._id.toString(); });

        var hasFarmerProduct = order.items.some(function (item) {
            return productIds.indexOf(item.product.toString()) !== -1;
        });

        if (!hasFarmerProduct) {
            return res.status(403).json({
                success: false,
                message: "Forbidden.",
                error: "You do not have permission to update this order."
            });
        }

        if (newStatus === "Accepted" && order.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition.",
                error: "Only pending orders can be accepted."
            });
        }
        if (newStatus === "Rejected" && order.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition.",
                error: "Only pending orders can be rejected."
            });
        }
        if (newStatus === "Completed" && order.status !== "Accepted") {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition.",
                error: "Only accepted orders can be marked as completed."
            });
        }

        order.status = newStatus;
        await order.save();

        try {
            var buyer = await User.findById(order.buyer).select("name email");
            var farmer = await User.findById(farmerId).select("name");
            if (buyer && buyer.email) {
                if (newStatus === "Accepted") {
                    await sendOrderAcceptedEmail(buyer.email, buyer.name, order, farmer ? farmer.name : "Farmer");
                } else if (newStatus === "Rejected") {
                    await sendOrderRejectedEmail(buyer.email, buyer.name, order);
                } else if (newStatus === "Completed") {
                    await sendOrderCompletedEmail(buyer.email, buyer.name, order);
                }
            }
        } catch (emailErr) {
            console.error("[Farmer] Order status email failed:", emailErr.message);
        }

        res.json({
            success: true,
            message: "Order status updated.",
            data: order
        });
    } catch (err) {
        console.error("[Farmer] Update order status error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update order status.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
