const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: "Other"
    },
    imageUrl: {
        type: String,
        default: ""
    },
    farmerName: {
        type: String,
        default: "Unknown Farmer"
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    lineTotal: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: {
        type: [OrderItemSchema],
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: "Order must contain at least one item."
        }
    },
    deliveryInfo: {
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        streetAddress: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        stateProvinceRegion: { type: String, default: "", trim: true },
        postalCode: { type: String, default: "", trim: true },
        country: { type: String, required: true, trim: true }
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: [
            "Pending Payment",
            "Pending",
            "Paid",
            "Processing",
            "Shipped",
            "Completed",
            "Cancelled",
            "Refunded",
            "Accepted",
            "Rejected"
        ],
        default: "Pending"
    },
    paymentStatus: {
        type: String,
        enum: ["Unpaid", "Pending", "Paid", "Failed", "Refunded"],
        default: "Pending"
    },
    paymentMethod: {
        type: String,
        enum: ["Card", "Mobile Money", "Bank Transfer", "DPO Pay", "Cash"],
        default: null
    },
    transactionId: {
        type: String,
        default: null
    },
    grossAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    commissionRate: {
        type: Number,
        min: 0,
        default: 2
    },
    commissionAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    farmerAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    platformAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    sellerAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    payoutStatus: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending"
    },
    completedAt: {
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

OrderSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("Order", OrderSchema);
