const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 2525,
    secure: false,

    auth: {
        user: process.env.EMAIL_SERVICE_USER,
        pass: process.env.EMAIL_SERVICE_PASS
    },

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
});

function ensureEmailConfig() {
    if (!process.env.EMAIL_SERVICE_USER || !process.env.EMAIL_SERVICE_PASS || !process.env.SENDER_EMAIL) {
        throw new Error("Email service is not configured.");
    }
}

const sendContactEmail = async (options) => {
    const adminRecipient = "placidesenadata35@gmail.com";

    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: adminRecipient,
        subject: `[New Inquiry] ${options.subject}`,
        replyTo: options.email,

        text: `New Contact Form Submission:

Name: ${options.name}
Email: ${options.email}
Subject: ${options.subject}

Message:
${options.message}`,

        html: `
            <p>You have received a new contact form submission:</p>

            <h3>Sender Details:</h3>
            <ul>
                <li><strong>Name:</strong> ${options.name}</li>
                <li><strong>Email:</strong> ${options.email}</li>
                <li><strong>Subject:</strong> ${options.subject}</li>
            </ul>

            <h3>Message:</h3>
            <p>${options.message.replace(/\n/g, '<br>')}</p>
        `
    };

    try {
        ensureEmailConfig();
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error("Email send failed:", error.message);
        throw error;

    }
};

const sendVerificationEmail = async (email, name, code) => {

    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: "Verify your AgriConnect account",

        text: `
Hello ${name},

Welcome to AgriConnect!

Your verification code is:

${code}

This code expires in 15 minutes.

If you did not create this account, you can ignore this email.

AgriConnect Team
        `,

        html: `
            <div style="font-family:Arial,sans-serif">

                <h2>Welcome to AgriConnect 🌾</h2>

                <p>Hello <strong>${name}</strong>,</p>

                <p>Thank you for creating your account.</p>

                <p>Please use the verification code below:</p>

                <h1 style="
                    background:#38a169;
                    color:white;
                    padding:15px;
                    width:180px;
                    text-align:center;
                    letter-spacing:6px;
                    border-radius:8px;">
                    ${code}
                </h1>

                <p>This code expires in <strong>15 minutes</strong>.</p>

                <p>If you didn't create this account, simply ignore this email.</p>

                <br>

                <p>AgriConnect Team</p>

            </div>
        `
    };
//console.log("EMAIL_SERVICE_USER:", process.env.EMAIL_SERVICE_USER);
//console.log("EMAIL_SERVICE_PASS exists:", !!process.env.EMAIL_SERVICE_PASS);
//console.log("SENDER_EMAIL:", process.env.SENDER_EMAIL);

    ensureEmailConfig();
    return transporter.sendMail(mailOptions);

};

module.exports = {
    sendContactEmail,
    sendVerificationEmail
};