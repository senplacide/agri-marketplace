const express = require("express");
var router = express.Router();
var ContactMessage = require("../models/ContactMessage");
var { sendContactEmail } = require("../utils/email");
var { validateContactInput } = require("../utils/validation");
var { contactLimiter } = require("../middleware/rateLimiter");

router.post("/", contactLimiter, async function (req, res) {
    var validation = validateContactInput(req.body);

    if (validation.error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            error: validation.error
        });
    }

    var name = validation.value.name;
    var email = validation.value.email;
    var subject = validation.value.subject;
    var message = validation.value.message;

    try {
        var newMessage = new ContactMessage({ name: name, email: email, subject: subject, message: message });
        await newMessage.save();
    } catch (dbError) {
        console.error("[Contact] Database save error:", dbError.message);
        return res.status(500).json({
            success: false,
            message: "Failed to save message.",
            error: "A database error occurred."
        });
    }

    try {
        await sendContactEmail({ name: name, email: email, subject: subject, message: message });
        res.json({
            success: true,
            message: "Message sent and saved."
        });
    } catch (emailError) {
        console.error("[Contact] Email send failed, but message was saved:", emailError.message);
        res.json({
            success: true,
            message: "Message saved, but email alert failed. We will contact you soon."
        });
    }
});

module.exports = router;
