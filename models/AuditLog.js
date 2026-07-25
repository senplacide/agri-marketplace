const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        trim: true
    },
    target: {
        type: String,
        required: true,
        trim: true
    },
    admin: {
        type: String,
        required: true,
        trim: true
    },
    details: {
        type: String,
        default: "",
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
