const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        maxlength: 50,
        default: "User"
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, "Please fill a valid email address"]
    },

    passwordHash: {
        type: String,
        required: [true, "Password hash is required"]
    },

    role: {
        type: String,
        enum: ["farmer", "buyer", "admin"],
        default: "farmer"
    },

    // -------------------------
    // Email verification fields
    // -------------------------
    isVerified: {
        type: Boolean,
        default: false
    },

    verificationCode: {
        type: String,
        default: null
    },

    verificationCodeExpires: {
        type: Date,
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

UserSchema.pre("save", function (next) {
    if (this.email) {
        this.email = this.email.trim().toLowerCase();
    }
    next();
});

// Never expose sensitive information
UserSchema.methods.toJSON = function () {
    const user = this.toObject();

    delete user.passwordHash;
    delete user.verificationCode;
    delete user.verificationCodeExpires;

    return user;
};

module.exports = mongoose.model("User", UserSchema);