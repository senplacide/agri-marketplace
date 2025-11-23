const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, match: [/.+@.+\..+/, 'Please enter a valid email address'] },
    subject: { type: String, trim: true, default: 'General Inquiry' },
    message: { type: String, required: true, trim: true },
    receivedAt: { type: Date, default: Date.now },
    isArchived: { type: Boolean, default: false }
});

const ContactMessage = mongoose.model('ContactMessage', ContactMessageSchema);
module.exports = ContactMessage;