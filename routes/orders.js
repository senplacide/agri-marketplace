const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
const { sendOrderPlacedEmail, sendNewOrderReceivedEmail } = require("../utils/email");
const { requireAuthWithUser } = require("../middleware/auth");
const { validateOrderInput, validateStatusInput, BUYER_ORDER_STATUSES } = require("../utils/validation");
const { PLATFORM_COMMISSION_PERCENT } = require("../config/payment");

const router = express.Router();

router.post("/", requireAuthWithUser, async function (req, res) {
    try {
        var validation = validateOrderInput(req.body);

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: validation.error
            });
        }

        var items = validation.value.items;
        var deliveryInfo = validation.value.deliveryInfo;

        var productIds = items.map(function (item) { return item.productId; });
        var products = await Product.find({ _id: { $in: productIds } }).populate("owner", "name email");
        var productMap = {};
        for (var p = 0; p < products.length; p++) {
            productMap[products[p]._id.toString()] = products[p];
        }

        var qtyNeeded = {};
        for (var q = 0; q < items.length; q++) {
            qtyNeeded[items[q].productId] = (qtyNeeded[items[q].productId] || 0) + items[q].quantity;
        }

        for (var c = 0; c < items.length; c++) {
            var dbProduct = productMap[items[c].productId];
            if (!dbProduct) {
                return res.status(400).json({
                    success: false,
                    message: "Order failed.",
                    error: "One or more products are no longer available."
                });
            }
            if (dbProduct.status !== "approved") {
                return res.status(400).json({
                    success: false,
                    message: "Order failed.",
                    error: dbProduct.name + " is not available for purchase."
                });
            }
            if (dbProduct.quantity < qtyNeeded[items[c].productId]) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient stock.",
                    error: "Only " + dbProduct.quantity + " unit(s) of " + dbProduct.name + " are available. Requested: " + qtyNeeded[items[c].productId] + "."
                });
            }
        }

        var totalPrice = 0;
        var processedItems = items.map(function (item) {
            var dbProduct = productMap[item.productId];
            var unitPrice = dbProduct ? dbProduct.price : item.unitPrice;
            var lineTotal = unitPrice * item.quantity;
            totalPrice += lineTotal;
            return {
                product: item.productId,
                productName: dbProduct ? dbProduct.name : item.productName,
                category: dbProduct ? dbProduct.category : (item.category || "Other"),
                imageUrl: dbProduct ? dbProduct.imageUrl : (item.imageUrl || ""),
                farmerName: dbProduct && dbProduct.owner ? dbProduct.owner.name : "Unknown Farmer",
                unitPrice: unitPrice,
                quantity: item.quantity,
                lineTotal: lineTotal
            };
        });

        var orderId = "ORD-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);

        var commissionRate = PLATFORM_COMMISSION_PERCENT;
        var commissionAmount = Math.round(totalPrice * commissionRate / 100);
        var farmerAmount = totalPrice - commissionAmount;
        var platformAmount = commissionAmount;

        var order = new Order({
            orderId: orderId,
            buyer: req.user._id,
            items: processedItems,
            deliveryInfo: {
                fullName: deliveryInfo.fullName,
                phone: deliveryInfo.phone,
                streetAddress: deliveryInfo.streetAddress,
                city: deliveryInfo.city,
                stateProvinceRegion: deliveryInfo.stateProvinceRegion || "",
                postalCode: deliveryInfo.postalCode || "",
                country: deliveryInfo.country
            },
            totalPrice: totalPrice,
            status: "Pending",
            grossAmount: totalPrice,
            commissionRate: commissionRate,
            commissionAmount: commissionAmount,
            farmerAmount: farmerAmount,
            platformAmount: platformAmount,
            sellerAmount: farmerAmount
        });

        var decremented = [];
        var rollbackStock = async function () {
            for (var r = 0; r < decremented.length; r++) {
                try {
                    await Product.updateOne(
                        { _id: decremented[r].productId },
                        { $inc: { quantity: decremented[r].qty } }
                    );
                } catch (rollbackErr) {
                    console.error("[Orders] Stock rollback failed for " + decremented[r].productId + ":", rollbackErr.message);
                }
            }
        };

        try {
            for (var productId in qtyNeeded) {
                var updated = await Product.findOneAndUpdate(
                    { _id: productId, quantity: { $gte: qtyNeeded[productId] } },
                    { $inc: { quantity: -qtyNeeded[productId] } },
                    { new: true }
                );
                if (!updated) {
                    await rollbackStock();
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient stock.",
                        error: "Stock changed before the order could be completed. Please try again."
                    });
                }
                decremented.push({ productId: productId, qty: qtyNeeded[productId] });
            }

            await order.save();
        } catch (err) {
            await rollbackStock();
            throw err;
        }

        try {
            await sendOrderPlacedEmail(req.user.email, req.user.name, order);
        } catch (emailErr) {
            console.error("[Orders] Order placed email failed:", emailErr.message);
        }

        var notifiedFarmers = {};
        for (var i = 0; i < products.length; i++) {
            var farmer = products[i].owner;
            if (farmer && farmer._id && !notifiedFarmers[farmer._id.toString()]) {
                notifiedFarmers[farmer._id.toString()] = true;
                var farmerItems = processedItems.filter(function (item) {
                    return item.product.toString() === products[i]._id.toString();
                });
                var farmerOrder = { orderId: order.orderId, items: farmerItems, totalPrice: order.totalPrice, deliveryInfo: order.deliveryInfo };

                try {
                    var itemNames = farmerItems.map(function (fi) { return fi.productName; }).join(", ");
                    await Notification.create({
                        user: farmer._id,
                        type: "new_order",
                        title: "New Order Received",
                        message: req.user.name + " placed an order (" + order.orderId + ") for: " + itemNames,
                        orderId: order.orderId
                    });
                } catch (notifErr) {
                    console.error("[Orders] Farmer notification creation failed:", notifErr.message);
                }

                try {
                    await sendNewOrderReceivedEmail(farmer.email, farmer.name, farmerOrder, req.user.name);
                } catch (emailErr) {
                    console.error("[Orders] Farmer notification email failed:", emailErr.message);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            data: order
        });
    } catch (err) {
        console.error("[Orders] Create error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to create order.",
            error: "An unexpected error occurred."
        });
    }
});

router.get("/", requireAuthWithUser, async function (req, res) {
    try {
        var orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 }).limit(100);
        res.json({
            success: true,
            data: orders
        });
    } catch (err) {
        console.error("[Orders] Fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders.",
            error: "An unexpected error occurred."
        });
    }
});

router.patch("/:orderId/status", requireAuthWithUser, async function (req, res) {
    try {
        var statusValidation = validateStatusInput(req.body, BUYER_ORDER_STATUSES);
        if (statusValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: statusValidation.error
            });
        }

        var order = await Order.findOne({ orderId: req.params.orderId, buyer: req.user._id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
                error: "The requested order does not exist."
            });
        }

        if (order.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition.",
                error: "Only pending orders can be cancelled."
            });
        }

        order.status = "Cancelled";
        await order.save();

        res.json({
            success: true,
            message: "Order cancelled.",
            data: order
        });
    } catch (err) {
        console.error("[Orders] Update status error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update order status.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
