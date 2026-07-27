const mongoose = require("mongoose");

const WithdrawRequestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        unique: true
    },
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    currency: {
        type: String,
        default: "RWF",
        enum: ["RWF", "USD"]
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "processing", "completed"],
        default: "pending"
    },
    payoutMethod: {
        type: String,
        enum: ["Mobile Money", "Bank Transfer", "Cash"],
        default: "Mobile Money"
    },
    payoutDetails: {
        type: String,
        trim: true,
        maxlength: 300,
        default: ""
    },
    adminNote: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    processedAt: {
        type: Date,
        default: null
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

WithdrawRequestSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("WithdrawRequest", WithdrawRequestSchema);
