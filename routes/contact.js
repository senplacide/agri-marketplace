const express = require("express");
const router = express.Router();
const ContactMessage = require('../models/ContactMessage'); 
const { sendContactEmail } = require('../utils/email'); 

router.post('/', async (req, res) => {
    const { name, email, subject, message } = req.body; 

    if (!name || !email || !message) {
        return res.status(400).json({ status: 'error', message: 'Name, email, and message are required.' });
    }

    // --- 1. SAVE TO MONGODB FIRST ---
    try {
        const newMessage = new ContactMessage({ name, email, subject, message });
        await newMessage.save();
        console.log('Message successfully saved to MongoDB.');

    } catch (dbError) {
        return res.status(500).json({ status: 'error', message: 'Failed to save message due to a database error.' });
    }
    
    // --- 2. SEND EMAIL ---
    try {
        await sendContactEmail({ name, email, subject, message });
        res.json({ status: 'success', message: 'Message successfully sent and saved!' });
    } catch (emailError) {
        console.error('EMAIL SEND FAILED, BUT MESSAGE WAS SAVED:', emailError.message);
        res.json({ 
            status: 'success_with_warning', 
            message: 'Message was saved to our records, but the email alert failed. We will contact you soon.' 
        });
    }
});

module.exports = router;