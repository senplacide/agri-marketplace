const express = require("express");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { sendOrderPlacedEmail, sendNewOrderReceivedEmail } = require("../utils/email");
const { requireAuthWithUser } = require("../middleware/auth");
const { validateOrderInput, validateStatusInput, validateObjectId, ORDER_STATUSES } = require("../utils/validation");

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

        var totalPrice = 0;
        var processedItems = items.map(function (item) {
            var lineTotal = item.unitPrice * item.quantity;
            totalPrice += lineTotal;
            return {
                product: item.productId,
                productName: item.productName,
                category: item.category || "Other",
                imageUrl: item.imageUrl || "",
                farmerName: item.farmerName || "Unknown Farmer",
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: lineTotal
            };
        });

        var orderId = "ORD-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);

        var order = new Order({
            orderId: orderId,
            buyer: req.user._id,
            items: processedItems,
            deliveryInfo: {
                fullName: deliveryInfo.fullName,
                phone: deliveryInfo.phone,
                district: deliveryInfo.district,
                sector: deliveryInfo.sector,
                cell: deliveryInfo.cell,
                village: deliveryInfo.village
            },
            totalPrice: totalPrice,
            status: "Pending"
        });

        await order.save();

        try {
            await sendOrderPlacedEmail(req.user.email, req.user.name, order);
        } catch (emailErr) {
            console.error("[Orders] Order placed email failed:", emailErr.message);
        }

        try {
            var productIds = processedItems.map(function (item) { return item.product; });
            var products = await Product.find({ _id: { $in: productIds } }).populate("owner", "name email");
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
        var orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 });
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
