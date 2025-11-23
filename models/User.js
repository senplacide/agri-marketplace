// models/User.js
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
        match: [/.+\@.+\..+/, 'Please fill a valid email address']
    },
    // We store the hashed password, created via bcrypt in the auth route
    passwordHash: {
        type: String,
        required: [true, "Password hash is required"]
    },
    role: {
        type: String,
        enum: ["farmer", "buyer", "admin"],
        default: "farmer" // Assuming sellers/farmers are the primary users
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Avoid returning the password hash even if the user object is returned accidentally
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.passwordHash;
    return user;
};

module.exports = mongoose.model("User", UserSchema);