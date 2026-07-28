const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
const { sendOrderPlacedEmail, sendNewOrderReceivedEmail } = require("../utils/email");
const { requireAuthWithUser } = require("../middleware/auth");
const { validateOrderInput, validateStatusInput, validateObjectId, ORDER_STATUSES } = require("../utils/validation");
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
                farmerName: dbProduct ? dbProduct.farmerName : (item.farmerName || "Unknown Farmer"),
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

        await order.save();

        try {
            await sendOrderPlacedEmail(req.user.email, req.user.name, order);
        } catch (emailErr) {
            console.error("[Orders] Order placed email failed:", emailErr.message);
        }

        try {
            var notifiedFarmers = {};
            for (var i = 0; i < products.length; i++) {
                var farmer = products[i].owner;
                if (farmer && farmer.email && !notifiedFarmers[farmer._id.toString()]) {
                    notifiedFarmers[farmer._id.toString()] = true;
                    var farmerItems = processedItems.filter(function (item) {
                        return item.product.toString() === products[i]._id.toString();
                    });
                    var farmerOrder = { orderId: order.orderId, items: farmerItems, totalPrice: order.totalPrice, deliveryInfo: order.deliveryInfo };
                    await sendNewOrderReceivedEmail(farmer.email, farmer.name, farmerOrder, req.user.name);

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
                }
            }
        } catch (emailErr) {
            console.error("[Orders] Farmer notification email failed:", emailErr.message);
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
        var statusValidation = validateStatusInput(req.body, ORDER_STATUSES);
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

        order.status = statusValidation.value.status;
        await order.save();

        res.json({
            success: true,
            message: "Order status updated.",
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
