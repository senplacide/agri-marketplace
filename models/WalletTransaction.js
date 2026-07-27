const mongoose = require("mongoose");

const WalletTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    walletType: {
        type: String,
        enum: ["farmer", "platform"],
        required: true
    },
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Wallet",
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null
    },
    withdrawRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WithdrawRequest",
        default: null
    },
    type: {
        type: String,
        enum: ["credit", "debit", "commission", "withdrawal", "refund", "adjustment"],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balanceBefore: {
        type: Number,
        default: 0
    },
    balanceAfter: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        trim: true,
        maxlength: 300,
        default: ""
    },
    status: {
        type: String,
        enum: ["completed", "pending", "failed"],
        default: "completed"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("WalletTransaction", WalletTransactionSchema);
