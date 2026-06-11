const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_SERVICE_USER,
    pass: process.env.EMAIL_SERVICE_PASS
  },

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000
});
/*
transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP Verify Error:", error);
    } else {
        console.log("SMTP Server is ready");
    }
});
*/
const sendContactEmail = async (options) => {
    const adminRecipient = process.env.EMAIL_SERVICE_USER;

    const mailOptions = {
        from: `AgriConnect Contact <${adminRecipient}>`,
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
        await transporter.sendMail(mailOptions);
        console.log(`Contact email alert sent successfully to ${adminRecipient}`);
    } catch (error) {
        console.error("NODEMAILER FULL ERROR:", error);
        throw error;
    }
};

module.exports = { sendContactEmail };