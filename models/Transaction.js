const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    grossAmount: {
        type: Number,
        required: true,
        min: 0
    },
    commissionAmount: {
        type: Number,
        required: true,
        min: 0
    },
    sellerAmount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: "RWF",
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ["Card", "Mobile Money", "Bank Transfer", "DPO Pay", "Cash"],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ["Unpaid", "Pending", "Paid", "Failed", "Refunded"],
        default: "Pending"
    },
    provider: {
        type: String,
        default: "DPO Pay"
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

TransactionSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("Transaction", TransactionSchema);
