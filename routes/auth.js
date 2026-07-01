const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail } = require("../utils/email");
const { validateSignupInput, validateAuthInput, normalizeEmail } = require("../utils/validation");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
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
    const normalizedEmail = normalizeEmail(email);
    console.log(`[AUTH_DEBUG] normalized email: ${normalizedEmail}`);
    const user = await User.findOne({
        email: {
            $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
        }
    });
    console.log(`[AUTH_DEBUG] findUserByEmail found user: ${Boolean(user)}`);
    if (user) {
        console.log(`[AUTH_DEBUG] stored email: ${user.email}`);
    }
    return user;
}

//
// SIGN UP
//
router.post("/signup", async (req, res) => {

    try {

        const signupValidation = validateSignupInput(req.body);

        if (signupValidation.error) {
            return res.status(400).json({ error: signupValidation.error });
        }

        const { name, email, password } = signupValidation.value;

        const existing = await findUserByEmail(email);

        if (existing) {
            return res.status(400).json({
                error: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const verificationCode = generateVerificationCode();

        const user = new User({
            name,
            email,
            passwordHash,
            isVerified: false,
            verificationCode,
            verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000)
        });

        try {
            await user.save();
        } catch (saveErr) {
            // Handle duplicate key (email) race or other save issues gracefully
            if (saveErr && saveErr.code === 11000) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            throw saveErr;
        }

        // Send verification email but don't fail signup if email sending fails.
        try {
            await sendVerificationEmail(user.email, user.name, verificationCode);
            return res.status(201).json({ message: 'Verification code sent.', email: user.email });
        } catch (emailErr) {
            console.error('[AUTH_DEBUG] verification email failed:', emailErr.message);
            return res.status(201).json({ message: 'Account created. Verification email failed to send.', email: user.email, warning: emailErr.message });
        }

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

//
// VERIFY EMAIL
//
router.post("/verify-email", async (req, res) => {

    try {

        const { email, code } = req.body;

        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        if (user.isVerified) {
            return res.json({
                message: "Email already verified."
            });
        }

        if (
            user.verificationCode !== code ||
            user.verificationCodeExpires < new Date()
        ) {
            return res.status(400).json({
                error: "Invalid or expired verification code."
            });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        user.email = normalizeEmail(user.email);

        await user.save();

        const token = createToken(user);

        res.json({
            message: "Email verified successfully.",
            token,
            user
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

//
// LOGIN
//
router.post("/login", async (req, res) => {

    try {

        const loginValidation = validateAuthInput(req.body);

        if (loginValidation.error) {
            return res.status(400).json({ error: loginValidation.error });
        }

        const { email, password } = loginValidation.value;

        const user = await findUserByEmail(email);

        if (!user) {
            console.log(`[AUTH_DEBUG] login failed because no user was found for ${email}`);
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const ok = await bcrypt.compare(
            password,
            user.passwordHash
        );
        console.log(`[AUTH_DEBUG] bcrypt.compare result: ${ok}`);

        if (!ok) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                error: "Please verify your email before signing in."
            });
        }

        const token = createToken(user);

        res.json({
            token,
            user
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

//
// CURRENT USER
//
router.get("/me", async (req, res) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        const token = auth.split(" ")[1];

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        const user = await User.findById(decoded.id)
            .select("-passwordHash");

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.json(user);

    } catch (err) {

        res.status(401).json({
            error: "Invalid or expired token"
        });

    }

});

module.exports = router;