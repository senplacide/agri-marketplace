const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendAdminNewUserEmail
} = require("../utils/email");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const { validateSignupInput, validateAuthInput, validateProfileInput, validatePasswordChangeInput, normalizeEmail, isValidEmail, isValidObjectId, stripHtml } = require("../utils/validation");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");
const { registerLimiter, loginLimiter, passwordResetLimiter, profileLimiter, passwordChangeLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function createToken(user) {
    return jwt.sign(
        {
            id: user._id,
            email: user.email
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN
        }
    );
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function findUserByEmail(email) {
    var normalizedEmail = normalizeEmail(email);
    var user = await User.findOne({
        email: {
            $regex: new RegExp("^" + normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i")
        }
    });
    return user;
}

//
// SIGN UP
//
router.post("/signup", registerLimiter, async function (req, res) {
    try {
        var signupValidation = validateSignupInput(req.body);

        if (signupValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: signupValidation.error
            });
        }

        var name = signupValidation.value.name;
        var email = signupValidation.value.email;
        var password = signupValidation.value.password;

        var allowedRoles = ["farmer", "buyer"];
        var requestedRole = req.body && req.body.role;
        var role = allowedRoles.indexOf(requestedRole) !== -1 ? requestedRole : "farmer";

        var existing = await findUserByEmail(email);

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Registration failed.",
                error: "Email already registered."
            });
        }

        var passwordHash = await bcrypt.hash(password, 12);

        var verificationCode = generateVerificationCode();

        var user = new User({
            name: name,
            email: email,
            passwordHash: passwordHash,
            role: role,
            isVerified: false,
            verificationCode: verificationCode,
            verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000)
        });

        try {
            await user.save();
        } catch (saveErr) {
            if (saveErr && saveErr.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Registration failed.",
                    error: "Email already registered."
                });
            }
            throw saveErr;
        }

        try {
            await sendVerificationEmail(user.email, user.name, verificationCode);
        } catch (emailErr) {
            console.error("[Auth] Verification email failed:", emailErr.message);
        }

        try {
            var admins = await User.find({ role: "admin" }).select("email");
            for (var i = 0; i < admins.length; i++) {
                await sendAdminNewUserEmail(admins[i].email, user);
            }
        } catch (emailErr) {
            console.error("[Auth] Admin notification failed:", emailErr.message);
        }

        return res.status(201).json({
            success: true,
            message: "Verification code sent.",
            email: user.email
        });
    } catch (err) {
        console.error("[Auth] Signup error:", err.message);
        res.status(500).json({
            success: false,
            message: "Registration failed.",
            error: "An unexpected error occurred."
        });
    }
});

//
// VERIFY EMAIL
//
router.post("/verify-email", async function (req, res) {
    try {
        var email = req.body && req.body.email;
        var code = req.body && req.body.code;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Email and verification code are required."
            });
        }

        email = normalizeEmail(email);

        var user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "No account found with that email."
            });
        }

        if (user.isVerified) {
            return res.json({
                success: true,
                message: "Email already verified."
            });
        }

        if (
            user.verificationCode !== code ||
            user.verificationCodeExpires < new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "Verification failed.",
                error: "Invalid or expired verification code."
            });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        user.email = normalizeEmail(user.email);

        await user.save();

        var token = createToken(user);

        res.json({
            success: true,
            message: "Email verified successfully.",
            token: token,
            user: user
        });
    } catch (err) {
        console.error("[Auth] Verify email error:", err.message);
        res.status(500).json({
            success: false,
            message: "Verification failed.",
            error: "An unexpected error occurred."
        });
    }
});

//
// RESEND VERIFICATION CODE
//
router.post("/resend-code", registerLimiter, async function (req, res) {
    try {
        var email = req.body && req.body.email;

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "A valid email address is required."
            });
        }

        var user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "No account found with that email."
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Already verified.",
                error: "This account is already verified."
            });
        }

        var verificationCode = generateVerificationCode();

        user.verificationCode = verificationCode;
        user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

        await user.save();

        await sendVerificationEmail(user.email, user.name, verificationCode);

        res.json({
            success: true,
            message: "A new verification code has been sent."
        });
    } catch (err) {
        console.error("[Auth] Resend code error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to resend code.",
            error: "An unexpected error occurred."
        });
    }
});

//
// LOGIN
//
router.post("/login", loginLimiter, async function (req, res) {
    try {
        var loginValidation = validateAuthInput(req.body);

        if (loginValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: loginValidation.error
            });
        }

        var email = loginValidation.value.email;
        var password = loginValidation.value.password;

        var user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Login failed.",
                error: "Invalid credentials."
            });
        }

        var ok = await bcrypt.compare(password, user.passwordHash);

        if (!ok) {
            return res.status(401).json({
                success: false,
                message: "Login failed.",
                error: "Invalid credentials."
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Email not verified.",
                error: "Please verify your email before signing in."
            });
        }

        if (user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: "Account suspended.",
                error: "Your account has been suspended. Please contact the administrator."
            });
        }

        var token = createToken(user);

        res.json({
            success: true,
            token: token,
            user: user
        });
    } catch (err) {
        console.error("[Auth] Login error:", err.message);
        res.status(500).json({
            success: false,
            message: "Login failed.",
            error: "An unexpected error occurred."
        });
    }
});

//
// CURRENT USER
//
router.get("/me", requireAuth, async function (req, res) {
    try {
        var user = await User.findById(req.userId)
            .select("-passwordHash");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "User account no longer exists."
            });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (err) {
        console.error("[Auth] Get user error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user.",
            error: "An unexpected error occurred."
        });
    }
});

//
// FORGOT PASSWORD
//
router.post("/forgot-password", passwordResetLimiter, async function (req, res) {
    try {
        var email = req.body && req.body.email;

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "A valid email address is required."
            });
        }

        var user = await findUserByEmail(email);

        if (!user) {
            return res.json({
                success: true,
                message: "If that email exists, a reset code has been sent."
            });
        }

        var code = generateVerificationCode();

        user.resetPasswordCode = code;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

        await user.save();

        await sendPasswordResetEmail(user.email, user.name, code);

        res.json({
            success: true,
            message: "If that email exists, a reset code has been sent."
        });
    } catch (err) {
        console.error("[Auth] Forgot password error:", err.message);
        res.status(500).json({
            success: false,
            message: "Password reset request failed.",
            error: "An unexpected error occurred."
        });
    }
});

//
// RESET PASSWORD
//
router.post("/reset-password", passwordResetLimiter, async function (req, res) {
    try {
        var email = req.body && req.body.email;
        var code = req.body && req.body.code;
        var password = req.body && req.body.password;

        if (!email || !code || !password) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Email, code, and new password are required."
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Invalid email format."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Password must be at least 8 characters long."
            });
        }

        if (password.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Password must be 128 characters or less."
            });
        }

        var user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "No account found with that email."
            });
        }

        if (
            user.resetPasswordCode !== code ||
            !user.resetPasswordExpires ||
            user.resetPasswordExpires < new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "Reset failed.",
                error: "Invalid or expired reset code."
            });
        }

        user.passwordHash = await bcrypt.hash(password, 12);
        user.resetPasswordCode = null;
        user.resetPasswordExpires = null;

        await user.save();

        res.json({
            success: true,
            message: "Password updated successfully."
        });
    } catch (err) {
        console.error("[Auth] Reset password error:", err.message);
        res.status(500).json({
            success: false,
            message: "Password reset failed.",
            error: "An unexpected error occurred."
        });
    }
});

//
// AVATAR UPLOAD STORAGE
//
var avatarStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async function (req, file) {
        return {
            folder: "agriconnect-avatars",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            public_id: "avatar-" + req.userId + "-" + Date.now()
        };
    }
});

var avatarFileFilter = function (req, file, cb) {
    var allowedTypes = /jpeg|jpg|png|webp/;
    if (allowedTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
    }
};

var avatarUpload = multer({
    storage: avatarStorage,
    fileFilter: avatarFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

//
// GET PROFILE
//
router.get("/profile", requireAuth, async function (req, res) {
    try {
        var user = await User.findById(req.userId).select("-passwordHash");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "User account no longer exists."
            });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (err) {
        console.error("[Auth] Get profile error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch profile.",
            error: "An unexpected error occurred."
        });
    }
});

//
// UPDATE PROFILE
//
router.put("/profile", requireAuth, profileLimiter, async function (req, res) {
    try {
        var profileValidation = validateProfileInput(req.body);

        if (profileValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: profileValidation.error
            });
        }

        var user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "User account no longer exists."
            });
        }

        user.name = profileValidation.value.name;
        user.phone = profileValidation.value.phone;
        user.address = profileValidation.value.address;
        user.bio = profileValidation.value.bio;

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully.",
            user: user
        });
    } catch (err) {
        console.error("[Auth] Update profile error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: "An unexpected error occurred."
        });
    }
});

//
// UPLOAD AVATAR
//
router.put("/avatar", requireAuth, profileLimiter, function (req, res) {
    avatarUpload.single("avatar")(req, res, async function (err) {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        success: false,
                        message: "File too large.",
                        error: "Avatar image must be 5MB or less."
                    });
                }
            }
            return res.status(400).json({
                success: false,
                message: "Upload failed.",
                error: err.message || "Failed to upload avatar."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded.",
                error: "Please select an image to upload."
            });
        }

        try {
            var user = await User.findById(req.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found.",
                    error: "User account no longer exists."
                });
            }

            if (user.avatar) {
                try {
                    var parts = user.avatar.split("/");
                    var filenameWithExt = parts[parts.length - 1];
                    var publicId = "agriconnect-avatars/" + filenameWithExt.split(".")[0];
                    await cloudinary.uploader.destroy(publicId);
                } catch (delErr) {
                    console.warn("[Auth] Failed to delete old avatar:", delErr.message);
                }
            }

            user.avatar = req.file.path;
            await user.save();

            res.json({
                success: true,
                message: "Avatar updated successfully.",
                avatar: user.avatar
            });
        } catch (saveErr) {
            console.error("[Auth] Avatar save error:", saveErr.message);
            res.status(500).json({
                success: false,
                message: "Failed to save avatar.",
                error: "An unexpected error occurred."
            });
        }
    });
});

//
// CHANGE PASSWORD
//
router.put("/change-password", requireAuth, passwordChangeLimiter, async function (req, res) {
    try {
        var passwordValidation = validatePasswordChangeInput(req.body);

        if (passwordValidation.error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: passwordValidation.error
            });
        }

        var user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error: "User account no longer exists."
            });
        }

        var currentPassword = passwordValidation.value.currentPassword;
        var newPassword = passwordValidation.value.newPassword;

        var isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect password.",
                error: "Current password is incorrect."
            });
        }

        user.passwordHash = await bcrypt.hash(newPassword, 12);
        user.lastPasswordChange = new Date();

        await user.save();

        res.json({
            success: true,
            message: "Password changed successfully."
        });
    } catch (err) {
        console.error("[Auth] Change password error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to change password.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
