const mongoose = require("mongoose");

const PlatformWalletSchema = new mongoose.Schema({
    label: {
        type: String,
        default: "Platform Wallet",
        trim: true
    },
    currency: {
        type: String,
        default: "RWF",
        enum: ["RWF", "USD"]
    },
    availableBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    pendingBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    totalCommissionEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
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

PlatformWalletSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("PlatformWallet", PlatformWalletSchema);
