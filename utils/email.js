const nodemailer = require('nodemailer');

function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    requireTLS: true,

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

/* ============================================================
   BASE EMAIL WRAPPER
============================================================ */

function baseLayout(title, bodyContent) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f5;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color:#276749;padding:24px 40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">
                                &#127807; AgriConnect
                            </h1>
                            <p style="margin:4px 0 0;color:#c6f6d5;font-size:12px;letter-spacing:0.5px;">Farm Fresh, Delivered</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:36px 40px;">
                            ${bodyContent}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f0fff4;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                            <p style="margin:0;color:#718096;font-size:12px;">
                                &copy; 2026 AgriConnect. All rights reserved.
                            </p>
                            <p style="margin:6px 0 0;color:#a0aec0;font-size:11px;">
                                Connecting farmers and buyers for a sustainable future.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function buildOrderTable(items, totalPrice) {
    let rows = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        rows += `
            <tr>
                <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#4a5568;font-size:14px;">
                    ${escapeHtml(item.productName)}
                    <br><span style="color:#a0aec0;font-size:12px;">${escapeHtml(item.farmerName || '')}</span>
                </td>
                <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#4a5568;font-size:14px;text-align:center;">
                    ${item.quantity}
                </td>
                <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#4a5568;font-size:14px;text-align:right;">
                    ${item.unitPrice.toLocaleString()} RWF
                </td>
                <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#276749;font-size:14px;text-align:right;font-weight:600;">
                    ${item.lineTotal.toLocaleString()} RWF
                </td>
            </tr>`;
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin:16px 0;">
        <thead>
            <tr style="background-color:#f7fafc;">
                <th style="padding:10px 12px;text-align:left;color:#2d3748;font-size:12px;font-weight:600;border-bottom:2px solid #e2e8f0;">Product</th>
                <th style="padding:10px 12px;text-align:center;color:#2d3748;font-size:12px;font-weight:600;border-bottom:2px solid #e2e8f0;">Qty</th>
                <th style="padding:10px 12px;text-align:right;color:#2d3748;font-size:12px;font-weight:600;border-bottom:2px solid #e2e8f0;">Unit Price</th>
                <th style="padding:10px 12px;text-align:right;color:#2d3748;font-size:12px;font-weight:600;border-bottom:2px solid #e2e8f0;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr style="background-color:#f0fff4;">
                <td colspan="3" style="padding:12px;text-align:right;color:#2d3748;font-size:14px;font-weight:700;border-top:2px solid #276749;">
                    Order Total:
                </td>
                <td style="padding:12px;text-align:right;color:#276749;font-size:16px;font-weight:700;border-top:2px solid #276749;">
                    ${totalPrice.toLocaleString()} RWF
                </td>
            </tr>
        </tbody>
    </table>`;
}

function buildDeliveryTable(deliveryInfo) {
    var addrLine2 = "";
    if (deliveryInfo.stateProvinceRegion || deliveryInfo.postalCode) {
        addrLine2 = "<br>" + (deliveryInfo.stateProvinceRegion ? escapeHtml(deliveryInfo.stateProvinceRegion) + ", " : "") + (deliveryInfo.postalCode ? escapeHtml(deliveryInfo.postalCode) : "");
    }
    return `
    <div style="background-color:#f7fafc;border-radius:6px;padding:16px;margin:16px 0;">
        <h3 style="margin:0 0 8px;color:#276749;font-size:14px;">Delivery Address</h3>
        <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.6;">
            ${escapeHtml(deliveryInfo.fullName)}<br>
            ${escapeHtml(deliveryInfo.streetAddress)}<br>
            ${escapeHtml(deliveryInfo.city)}${addrLine2}<br>
            ${escapeHtml(deliveryInfo.country)}<br>
            Phone: ${escapeHtml(deliveryInfo.phone)}
        </p>
    </div>`;
}

/* ============================================================
   BUYER EMAILS
============================================================ */

const sendOrderPlacedEmail = async (buyerEmail, buyerName, order) => {
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">Order Confirmation</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(buyerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            Thank you for your order! We have received your order and it is now being processed.
        </p>
        <div style="background-color:#f0fff4;border-left:4px solid #38a169;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#276749;font-size:14px;font-weight:600;">Order ID: ${order.orderId}</p>
        </div>
        ${buildOrderTable(order.items, order.totalPrice)}
        ${buildDeliveryTable(order.deliveryInfo)}
        <p style="margin:24px 0 0;color:#4a5568;font-size:14px;line-height:1.6;">
            Thank you for choosing AgriConnect. We appreciate your support for local farmers!
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('Order Confirmation', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: buyerEmail,
        subject: "Order Confirmation",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

const sendOrderAcceptedEmail = async (buyerEmail, buyerName, order, farmerName) => {
    const productNames = escapeHtml(order.items.map(function (i) { return i.productName; }).join(', '));
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">Your Order Has Been Accepted</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(buyerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            Great news! Your order <strong>${escapeHtml(order.orderId)}</strong> has been accepted by the farmer.
        </p>
        <div style="background-color:#f7fafc;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Product:</strong> ${productNames}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Farmer:</strong> ${escapeHtml(farmerName)}</p>
            <p style="margin:0;color:#2d3748;font-size:14px;"><strong>Estimated Next Step:</strong> The farmer is preparing your order for delivery. You will be notified once it is completed.</p>
        </div>
        <p style="margin:24px 0 0;color:#4a5568;font-size:14px;line-height:1.6;">
            Thank you for your patience. If you have any questions, feel free to reach out.
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('Order Accepted', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: buyerEmail,
        subject: "Your Order Has Been Accepted",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

const sendOrderRejectedEmail = async (buyerEmail, buyerName, order) => {
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">Order Update</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(buyerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            We regret to inform you that your order <strong>${escapeHtml(order.orderId)}</strong> could not be fulfilled at this time. The farmer has declined the order.
        </p>
        <div style="background-color:#fff5f5;border-left:4px solid #e53e3e;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#c53030;font-size:14px;">Order Status: Rejected</p>
        </div>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            We encourage you to browse other available products on AgriConnect. We apologize for the inconvenience.
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('Order Update', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: buyerEmail,
        subject: "Order Update",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

const sendOrderCompletedEmail = async (buyerEmail, buyerName, order) => {
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">Order Completed</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(buyerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            Your order <strong>${escapeHtml(order.orderId)}</strong> has been completed successfully. We hope you enjoy your fresh produce!
        </p>
        <div style="background-color:#f0fff4;border-left:4px solid #38a169;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#276749;font-size:14px;font-weight:600;">Order Total: ${order.totalPrice.toLocaleString()} RWF</p>
        </div>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            Thank you for choosing AgriConnect. Your support helps local farmers thrive. We invite you to shop with us again soon!
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('Order Completed', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: buyerEmail,
        subject: "Order Completed",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

/* ============================================================
   FARMER EMAILS
============================================================ */

const sendNewOrderReceivedEmail = async (farmerEmail, farmerName, order, buyerName) => {
    const productNames = escapeHtml(order.items.map(function (i) { return i.productName; }).join(', '));
    const quantities = order.items.map(function (i) { return escapeHtml(i.productName) + ': ' + i.quantity; }).join(', ');
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">New Customer Order</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(farmerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            You have received a new order on AgriConnect! Please review and respond to this order promptly.
        </p>
        <div style="background-color:#f0fff4;border-left:4px solid #38a169;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#276749;font-size:14px;font-weight:600;">Order ID: ${escapeHtml(order.orderId)}</p>
        </div>
        <div style="background-color:#f7fafc;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Buyer:</strong> ${escapeHtml(buyerName)}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Product(s):</strong> ${productNames}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Quantity:</strong> ${quantities}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;">
                <strong>Delivery:</strong>
                ${escapeHtml(order.deliveryInfo.streetAddress)}, ${escapeHtml(order.deliveryInfo.city)}${order.deliveryInfo.stateProvinceRegion ? ", " + escapeHtml(order.deliveryInfo.stateProvinceRegion) : ""}${order.deliveryInfo.postalCode ? ", " + escapeHtml(order.deliveryInfo.postalCode) : ""}, ${escapeHtml(order.deliveryInfo.country)}
            </p>
            <p style="margin:0;color:#276749;font-size:16px;font-weight:700;">Order Total: ${order.totalPrice.toLocaleString()} RWF</p>
        </div>
        <p style="margin:24px 0 0;color:#4a5568;font-size:14px;line-height:1.6;">
            Log in to your dashboard to accept or reject this order.
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('New Customer Order', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: farmerEmail,
        subject: "New Customer Order",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

const sendProductApprovedEmail = async (farmerEmail, farmerName, productName) => {
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">Product Approved</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(farmerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            Your product <strong>${escapeHtml(productName)}</strong> has been reviewed and approved by our admin team.
        </p>
        <div style="background-color:#f0fff4;border-left:4px solid #38a169;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#276749;font-size:14px;font-weight:600;">Your product is now live and visible to buyers on the marketplace.</p>
        </div>
        <p style="margin:24px 0 0;color:#4a5568;font-size:14px;line-height:1.6;">
            Thank you for listing with AgriConnect. We wish you great sales!
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('Product Approved', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: farmerEmail,
        subject: "Product Approved",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

const sendProductRejectedEmail = async (farmerEmail, farmerName, productName, reason) => {
    const reasonSection = reason
        ? `<div style="background-color:#fff5f5;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 4px;color:#2d3748;font-size:14px;"><strong>Rejection Reason:</strong></p>
            <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.6;">${escapeHtml(reason)}</p>
           </div>`
        : '';
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">Product Rejected</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            Hello <strong>${escapeHtml(farmerName)}</strong>,
        </p>
        <p style="margin:0 0 16px;color:#4a5568;font-size:15px;line-height:1.6;">
            Your product <strong>${escapeHtml(productName)}</strong> has been reviewed and could not be approved at this time.
        </p>
        <div style="background-color:#fff5f5;border-left:4px solid #e53e3e;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#c53030;font-size:14px;">Product Status: Rejected</p>
        </div>
        ${reasonSection}
        <p style="margin:24px 0 0;color:#4a5568;font-size:14px;line-height:1.6;">
            Please review the feedback and update your product if necessary. You can resubmit it for review from your dashboard.
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">AgriConnect Team</p>
    `;
    const html = baseLayout('Product Rejected', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: farmerEmail,
        subject: "Product Rejected",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

/* ============================================================
   ADMIN EMAILS
============================================================ */

const sendAdminNewUserEmail = async (adminEmail, user) => {
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">New User Registered</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            A new user has joined AgriConnect:
        </p>
        <div style="background-color:#f7fafc;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Name:</strong> ${escapeHtml(user.name)}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Email:</strong> ${escapeHtml(user.email)}</p>
            <p style="margin:0;color:#2d3748;font-size:14px;"><strong>Role:</strong> ${escapeHtml(user.role)}</p>
        </div>
        <p style="margin:24px 0 0;color:#718096;font-size:13px;">This is an automated notification from AgriConnect.</p>
    `;
    const html = baseLayout('New User Registered', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: adminEmail,
        subject: "New User Registered",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

const sendAdminNewProductEmail = async (adminEmail, product, farmerName) => {
    const body = `
        <h2 style="margin:0 0 8px;color:#276749;font-size:22px;">New Product Submitted</h2>
        <p style="margin:0 0 4px;color:#718096;font-size:13px;">${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
        <p style="margin:16px 0;color:#4a5568;font-size:15px;">
            A new product has been submitted for review:
        </p>
        <div style="background-color:#f7fafc;border-radius:6px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Product:</strong> ${escapeHtml(product.name)}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Category:</strong> ${escapeHtml(product.category)}</p>
            <p style="margin:0 0 8px;color:#2d3748;font-size:14px;"><strong>Price:</strong> ${escapeHtml(product.price.toLocaleString())} RWF</p>
            <p style="margin:0;color:#2d3748;font-size:14px;"><strong>Farmer:</strong> ${escapeHtml(farmerName)}</p>
        </div>
        <p style="margin:24px 0 0;color:#4a5568;font-size:14px;line-height:1.6;">
            Please review this product in your admin dashboard.
        </p>
        <p style="margin:8px 0 0;color:#718096;font-size:13px;">This is an automated notification from AgriConnect.</p>
    `;
    const html = baseLayout('New Product Submitted', body);
    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: adminEmail,
        subject: "New Product Submitted",
        html
    };
    ensureEmailConfig();
    return transporter.sendMail(mailOptions);
};

/* ============================================================
   CONTACT EMAIL (existing)
============================================================ */

const sendContactEmail = async (options) => {
    const adminRecipient = process.env.ADMIN_EMAIL || "placidesenadata35@gmail.com";

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
                <li><strong>Name:</strong> ${escapeHtml(options.name)}</li>
                <li><strong>Email:</strong> ${escapeHtml(options.email)}</li>
                <li><strong>Subject:</strong> ${escapeHtml(options.subject)}</li>
            </ul>

            <h3>Message:</h3>
            <p>${escapeHtml(options.message).replace(/\n/g, '<br>')}</p>
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

/* ============================================================
   VERIFICATION & PASSWORD RESET (existing)
============================================================ */

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

                <h2>Welcome to AgriConnect &#127806;</h2>

                <p>Hello <strong>${escapeHtml(name)}</strong>,</p>

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

    ensureEmailConfig();
    return transporter.sendMail(mailOptions);

};
const sendPasswordResetEmail = async (email, name, code) => {

    const mailOptions = {
        from: `"AgriConnect" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: "Reset your AgriConnect password",

        text: `
Hello ${name},

We received a request to reset your password.

Your password reset code is:

${code}

This code expires in 15 minutes.

If you did not request a password reset, you can safely ignore this email.

AgriConnect Team
        `,

        html: `
        <div style="font-family:Arial,sans-serif">

            <h2>Password Reset &#128272;</h2>

            <p>Hello <strong>${escapeHtml(name)}</strong>,</p>

            <p>Use the code below to reset your password:</p>

            <h1 style="
                background:#e53e3e;
                color:white;
                padding:15px;
                width:180px;
                text-align:center;
                letter-spacing:6px;
                border-radius:8px;">
                ${code}
            </h1>

            <p>This code expires in <strong>15 minutes</strong>.</p>

            <p>If you didn't request this reset, simply ignore this email.</p>

            <br>

            <p>AgriConnect Team</p>

        </div>
        `
    };

    ensureEmailConfig();
    return transporter.sendMail(mailOptions);

};

module.exports = {
    sendContactEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendOrderPlacedEmail,
    sendOrderAcceptedEmail,
    sendOrderRejectedEmail,
    sendOrderCompletedEmail,
    sendNewOrderReceivedEmail,
    sendProductApprovedEmail,
    sendProductRejectedEmail,
    sendAdminNewUserEmail,
    sendAdminNewProductEmail
};
