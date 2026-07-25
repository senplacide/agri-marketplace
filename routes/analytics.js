const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { requireAuth } = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

const router = express.Router();

function getDateFilter(period) {
    if (!period || period === "all") return null;
    var now = new Date();
    var start;
    switch (period) {
        case "today":
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case "7days":
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case "30days":
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case "year":
            start = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            return null;
    }
    return start;
}

function groupByMonth(items, dateField) {
    var result = {};
    items.forEach(function (item) {
        var d = new Date(item[dateField]);
        var key = d.getFullYear() + "-" + (d.getMonth() + 1);
        if (!result[key]) {
            result[key] = { year: d.getFullYear(), month: d.getMonth() + 1, count: 0, total: 0 };
        }
        result[key].count++;
        result[key].total += item.totalPrice || 0;
    });
    return Object.values(result).sort(function (a, b) {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
}

/*
==================================================
FARMER ANALYTICS
==================================================
*/
router.get("/farmer", requireAuth, async function (req, res) {
    try {
        var farmerId = req.userId;
        var period = req.query.period;
        var dateStart = getDateFilter(period);

        var farmerProducts = await Product.find({ owner: farmerId }).select("_id");
        var productIds = farmerProducts.map(function (p) { return p._id; });

        if (productIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    totalSales: 0, totalOrders: 0, completedOrders: 0,
                    pendingOrders: 0, rejectedOrders: 0, totalRevenue: 0,
                    monthlySales: [], ordersByStatus: [], bestSellingProducts: []
                }
            });
        }

        var query = { "items.product": { $in: productIds } };
        if (dateStart) query.createdAt = { $gte: dateStart };

        var orders = await Order.find(query).sort({ createdAt: -1 });

        var totalSales = 0;
        var totalRevenue = 0;
        var completedOrders = 0;
        var pendingOrders = 0;
        var rejectedOrders = 0;
        var productSales = {};

        orders.forEach(function (order) {
            var normalizedStatus = (order.status || "pending").toLowerCase();
            if (normalizedStatus === "completed" || normalizedStatus === "accepted") {
                completedOrders++;
            }
            if (normalizedStatus === "pending") pendingOrders++;
            if (normalizedStatus === "rejected") rejectedOrders++;

            order.items.forEach(function (item) {
                var pid = item.product ? item.product.toString() : "";
                if (productIds.some(function (id) { return id.toString() === pid; })) {
                    var lineRev = (item.unitPrice || 0) * (item.quantity || 0);
                    totalSales += lineRev;
                    if (normalizedStatus === "completed" || normalizedStatus === "accepted") {
                        totalRevenue += lineRev;
                    }
                    if (!productSales[pid]) {
                        productSales[pid] = { productName: item.productName || "Unknown", totalQuantity: 0, totalRevenue: 0 };
                    }
                    productSales[pid].totalQuantity += item.quantity || 0;
                    productSales[pid].totalRevenue += lineRev;
                }
            });
        });

        var monthlySales = groupByMonth(orders, "createdAt");
        monthlySales = monthlySales.map(function (m) {
            return { _id: { year: m.year, month: m.month }, sales: m.total, orders: m.count };
        });

        var ordersByStatus = [];
        if (pendingOrders > 0) ordersByStatus.push({ status: "Pending", count: pendingOrders });
        if (completedOrders > 0) ordersByStatus.push({ status: "Completed", count: completedOrders });
        if (rejectedOrders > 0) ordersByStatus.push({ status: "Rejected", count: rejectedOrders });

        var bestSellingProducts = Object.values(productSales).sort(function (a, b) {
            return b.totalQuantity - a.totalQuantity;
        }).slice(0, 10);

        res.json({
            success: true,
            data: {
                totalSales: totalSales,
                totalOrders: orders.length,
                completedOrders: completedOrders,
                pendingOrders: pendingOrders,
                rejectedOrders: rejectedOrders,
                totalRevenue: totalRevenue,
                monthlySales: monthlySales,
                ordersByStatus: ordersByStatus,
                bestSellingProducts: bestSellingProducts
            }
        });
    } catch (err) {
        console.error("[Analytics] Farmer analytics error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load analytics.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
BUYER ANALYTICS
==================================================
*/
router.get("/buyer", requireAuth, async function (req, res) {
    try {
        var buyerId = req.userId;
        var period = req.query.period;
        var dateStart = getDateFilter(period);

        var query = { buyer: buyerId };
        if (dateStart) query.createdAt = { $gte: dateStart };

        var orders = await Order.find(query).sort({ createdAt: -1 });

        var totalAmountSpent = 0;
        var completedOrders = 0;
        var pendingOrders = 0;

        orders.forEach(function (order) {
            var ns = (order.status || "pending").toLowerCase();
            if (ns === "completed" || ns === "accepted") {
                completedOrders++;
                totalAmountSpent += order.totalPrice || 0;
            }
            if (ns === "pending") pendingOrders++;
        });

        var monthlyPurchases = groupByMonth(orders, "createdAt");
        monthlyPurchases = monthlyPurchases.map(function (m) {
            return { _id: { year: m.year, month: m.month }, count: m.count, amount: m.total };
        });

        res.json({
            success: true,
            data: {
                totalOrders: orders.length,
                completedOrders: completedOrders,
                pendingOrders: pendingOrders,
                totalAmountSpent: totalAmountSpent,
                monthlyPurchases: monthlyPurchases
            }
        });
    } catch (err) {
        console.error("[Analytics] Buyer analytics error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load analytics.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
ADMIN ANALYTICS
==================================================
*/
router.get("/admin", requireAdmin, async function (req, res) {
    try {
        var period = req.query.period;
        var dateStart = getDateFilter(period);

        var query = {};
        if (dateStart) query.createdAt = { $gte: dateStart };

        var orders = await Order.find(query)
            .populate("buyer", "name email")
            .sort({ createdAt: -1 });

        var marketplaceRevenue = 0;
        var totalOrders = orders.length;
        var farmerSales = {};
        var buyerSpending = {};
        var productPurchases = {};
        var categoryRevenue = {};

        orders.forEach(function (order) {
            var ns = (order.status || "pending").toLowerCase();
            if (ns === "completed" || ns === "accepted") {
                marketplaceRevenue += order.totalPrice || 0;
            }

            var buyerName = order.buyer ? order.buyer.name : "Unknown";
            var buyerEmail = order.buyer ? order.buyer.email : "";
            if (!buyerSpending[buyerName]) {
                buyerSpending[buyerName] = { name: buyerName, email: buyerEmail, totalSpent: 0, orderCount: 0 };
            }
            buyerSpending[buyerName].orderCount++;
            if (ns === "completed" || ns === "accepted") {
                buyerSpending[buyerName].totalSpent += order.totalPrice || 0;
            }

            if (order.items) {
                order.items.forEach(function (item) {
                    var farmerName = item.farmerName || "Unknown";
                    if (!farmerSales[farmerName]) {
                        farmerSales[farmerName] = { name: farmerName, totalSales: 0, orderCount: 0 };
                    }
                    var lineRev = (item.unitPrice || 0) * (item.quantity || 0);
                    if (ns === "completed" || ns === "accepted") {
                        farmerSales[farmerName].totalSales += lineRev;
                    }
                    farmerSales[farmerName].orderCount++;

                    var prodKey = item.productName || "Unknown";
                    if (!productPurchases[prodKey]) {
                        productPurchases[prodKey] = { productName: prodKey, totalQuantity: 0, totalRevenue: 0 };
                    }
                    productPurchases[prodKey].totalQuantity += item.quantity || 0;
                    if (ns === "completed" || ns === "accepted") {
                        productPurchases[prodKey].totalRevenue += lineRev;
                    }

                    var cat = item.category || "Other";
                    if (!categoryRevenue[cat]) {
                        categoryRevenue[cat] = { category: cat, revenue: 0, count: 0 };
                    }
                    if (ns === "completed" || ns === "accepted") {
                        categoryRevenue[cat].revenue += lineRev;
                    }
                    categoryRevenue[cat].count++;
                });
            }
        });

        var monthlyOrders = groupByMonth(orders, "createdAt");
        monthlyOrders = monthlyOrders.map(function (m) {
            return { _id: { year: m.year, month: m.month }, count: m.count };
        });

        var revenueByMonth = groupByMonth(orders.filter(function (o) {
            var ns = (o.status || "").toLowerCase();
            return ns === "completed" || ns === "accepted";
        }), "createdAt");
        revenueByMonth = revenueByMonth.map(function (m) {
            return { _id: { year: m.year, month: m.month }, revenue: m.total };
        });

        var topFarmers = Object.values(farmerSales).sort(function (a, b) {
            return b.totalSales - a.totalSales;
        }).slice(0, 10);

        var topBuyers = Object.values(buyerSpending).sort(function (a, b) {
            return b.totalSpent - a.totalSpent;
        }).slice(0, 10);

        var mostPurchasedProducts = Object.values(productPurchases).sort(function (a, b) {
            return b.totalQuantity - a.totalQuantity;
        }).slice(0, 10);

        var salesByCategory = Object.values(categoryRevenue).sort(function (a, b) {
            return b.revenue - a.revenue;
        });

        res.json({
            success: true,
            data: {
                totalOrders: totalOrders,
                marketplaceRevenue: marketplaceRevenue,
                monthlyOrders: monthlyOrders,
                revenueByMonth: revenueByMonth,
                topFarmers: topFarmers,
                topBuyers: topBuyers,
                mostPurchasedProducts: mostPurchasedProducts,
                salesByCategory: salesByCategory
            }
        });
    } catch (err) {
        console.error("[Analytics] Admin analytics error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load analytics.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
