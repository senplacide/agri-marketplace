// models/Product.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Product name is required"],
        trim: true
    },
    price: {
        type: Number,
        required: [true, "Price is required"],
        min: 0
    },
    category: {
        type: String,
        required: [true, "Category is required"],
        enum: ["Fruits", "Vegetables", "Grains", "Livestock", "Equipment", "Other"]
    },
    description: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String,
        trim: true,
        default: "" // Optional image URL
    },
    contact: {
        type: String,
        trim: true
    },
    // NEW FIELD: Restrict payment methods to MoMo and Visa Card
    paymentMethods: {
        type: [String],
        required: [true, "Accepted payment methods are required"],
        enum: ["Visa Card", "Mobile Money (MoMo)"],
        default: ["Mobile Money (MoMo)"]
    },
    // Reference to the user who created the listing
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Product", ProductSchema);