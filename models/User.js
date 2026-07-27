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
    isSuspended: {
    type: Boolean,
    default: false
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
    resetPasswordCode: {
    type: String,
    default: null
    },

    resetPasswordExpires: {
        type: Date,
        default: null
    },

    phone: {
        type: String,
        trim: true,
        maxlength: 20,
        default: ""
    },

    address: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ""
    },

    bio: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    },

    avatar: {
        type: String,
        default: ""
    },

    businessName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ""
    },

    country: {
        type: String,
        trim: true,
        maxlength: 60,
        default: ""
    },

    city: {
        type: String,
        trim: true,
        maxlength: 60,
        default: ""
    },

    preferredPayoutMethod: {
        type: String,
        enum: ["Mobile Money", "Bank Transfer", "Cash", ""],
        default: ""
    },

    bankName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ""
    },

    bankAccountNumber: {
        type: String,
        trim: true,
        maxlength: 40,
        default: ""
    },

    bankAccountName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ""
    },

    momoNumber: {
        type: String,
        trim: true,
        maxlength: 20,
        default: ""
    },

    lastLogin: {
        type: Date,
        default: null
    },

    lastPasswordChange: {
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

    delete user.resetPasswordCode;
    delete user.resetPasswordExpires;

    return user;
};

module.exports = mongoose.model("User", UserSchema);