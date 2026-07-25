const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONGO_OBJECTID_REGEX = /^[0-9a-fA-F]{24}$/;
const ALLOWED_PRODUCT_CATEGORIES = ["Fruits", "Vegetables", "Grains", "Livestock", "Equipment", "Other"];
const ALLOWED_PAYMENT_METHODS = ["Visa Card", "Mobile Money (MoMo)"];
const ORDER_STATUSES = ["Pending", "Processing", "Completed", "Cancelled"];
const FARMER_ORDER_STATUSES = ["Accepted", "Rejected", "Completed"];
const USER_ROLES = ["farmer", "buyer", "admin"];

function sanitizeText(value) {
    if (typeof value !== "string") return "";
    return value
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .trim();
}

function stripHtml(value) {
    if (typeof value !== "string") return "";
    return value
        .replace(/<[^>]*>/g, "")
        .trim();
}

function normalizeEmail(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
}

function isValidEmail(email) {
    return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

function isValidObjectId(id) {
    return typeof id === "string" && MONGO_OBJECTID_REGEX.test(id);
}

function validateAuthInput(body) {
    var email = normalizeEmail(body && body.email);
    var password = typeof (body && body.password) === "string" ? body.password : "";

    if (!email) {
        return { error: "Email is required." };
    }

    if (!isValidEmail(email)) {
        return { error: "Please provide a valid email address." };
    }

    if (!password) {
        return { error: "Password is required." };
    }

    if (password.length < 8) {
        return { error: "Password must be at least 8 characters long." };
    }

    if (password.length > 128) {
        return { error: "Password must be 128 characters or less." };
    }

    return { value: { email: email, password: password } };
}

function validateSignupInput(body) {
    var name = stripHtml(body && body.name);
    var auth = validateAuthInput(body);

    if (auth.error) return auth;

    if (!name) {
        return { error: "Name is required." };
    }

    if (name.length < 2) {
        return { error: "Name must be at least 2 characters long." };
    }

    if (name.length > 50) {
        return { error: "Name must be 50 characters or less." };
    }

    return { value: { name: name, email: auth.value.email, password: auth.value.password } };
}

function validateProductInput(body, opts) {
    opts = opts || {};
    var partial = opts.partial || false;

    var name = stripHtml(body && body.name);
    var price = Number(body && body.price);
    var category = sanitizeText(body && body.category);
    var description = stripHtml(body && body.description);
    var contact = sanitizeText(body && body.contact);
    var imageUrl = sanitizeText(body && body.imageUrl);
    var quantity = body && body.quantity !== undefined ? Number(body.quantity) : undefined;
    var paymentMethods = [];

    if (Array.isArray(body && body.paymentMethods)) {
        paymentMethods = body.paymentMethods.filter(function (value) {
            return typeof value === "string" && value.trim();
        });
    } else if (typeof (body && body.paymentMethods) === "string") {
        paymentMethods = [body.paymentMethods.trim()];
    }

    if (!partial || body.name !== undefined) {
        if (!name || name.length < 2) {
            return { error: "Product name must be at least 2 characters long." };
        }
        if (name.length > 100) {
            return { error: "Product name must be 100 characters or less." };
        }
    }

    if (!partial || body.price !== undefined) {
        if (isNaN(price) || !Number.isFinite(price)) {
            return { error: "Price must be a valid number." };
        }
        if (price < 0) {
            return { error: "Price cannot be negative." };
        }
        if (price > 10000000) {
            return { error: "Price seems unreasonably high." };
        }
    }

    if (quantity !== undefined) {
        if (isNaN(quantity) || !Number.isFinite(quantity)) {
            return { error: "Quantity must be a valid number." };
        }
        if (quantity < 0) {
            return { error: "Quantity cannot be negative." };
        }
        if (!Number.isInteger(quantity)) {
            return { error: "Quantity must be a whole number." };
        }
    }

    if (!partial || body.category !== undefined) {
        if (!ALLOWED_PRODUCT_CATEGORIES.includes(category)) {
            return { error: "Please choose a valid product category. Allowed: " + ALLOWED_PRODUCT_CATEGORIES.join(", ") };
        }
    }

    if (description && description.length > 1000) {
        return { error: "Description must be 1000 characters or less." };
    }

    if (!partial || body.contact !== undefined) {
        if (!contact) {
            return { error: "Contact details are required." };
        }
        if (contact.length > 100) {
            return { error: "Contact must be 100 characters or less." };
        }
    }

    if (imageUrl && !/^https?:\/\/\S+/i.test(imageUrl)) {
        return { error: "Invalid image URL." };
    }

    if (!partial || body.paymentMethods !== undefined) {
        if (paymentMethods.length === 0) {
            return { error: "Please select at least one payment method." };
        }

        var invalidMethod = paymentMethods.find(function (method) {
            return !ALLOWED_PAYMENT_METHODS.includes(method);
        });
        if (invalidMethod) {
            return { error: "Invalid payment method: " + invalidMethod };
        }
    }

    var result = {};
    if (name) result.name = name;
    if (Number.isFinite(price)) result.price = price;
    if (category) result.category = category;
    if (description) result.description = description;
    if (contact) result.contact = contact;
    if (imageUrl) result.imageUrl = imageUrl;
    if (paymentMethods.length) result.paymentMethods = paymentMethods;
    if (quantity !== undefined && Number.isFinite(quantity)) result.quantity = quantity;
    if (body && body.owner) result.owner = body.owner;

    return { value: result };
}

function validateContactInput(body) {
    var name = stripHtml(body && body.name);
    var email = normalizeEmail(body && body.email);
    var subject = sanitizeText(body && body.subject);
    var message = stripHtml(body && body.message);

    if (!name || name.length < 2) {
        return { error: "Name must be at least 2 characters long." };
    }

    if (name.length > 100) {
        return { error: "Name must be 100 characters or less." };
    }

    if (!isValidEmail(email)) {
        return { error: "Please provide a valid email address." };
    }

    if (!message || message.length < 10) {
        return { error: "Message must be at least 10 characters long." };
    }

    if (message.length > 5000) {
        return { error: "Message must be 5000 characters or less." };
    }

    if (subject && subject.length > 200) {
        return { error: "Subject must be 200 characters or less." };
    }

    return {
        value: {
            name: name,
            email: email,
            subject: subject || "General Inquiry",
            message: message
        }
    };
}

function validateOrderInput(body) {
    var items = body && body.items;
    var deliveryInfo = body && body.deliveryInfo;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return { error: "At least one item is required." };
    }

    if (items.length > 50) {
        return { error: "Maximum 50 items per order." };
    }

    for (var i = 0; i < items.length; i++) {
        var item = items[i];

        if (!item.productId || !isValidObjectId(item.productId)) {
            return { error: "Invalid product ID in item " + (i + 1) + "." };
        }

        if (!item.productName || typeof item.productName !== "string" || !item.productName.trim()) {
            return { error: "Product name is required in item " + (i + 1) + "." };
        }

        if (item.productName.length > 200) {
            return { error: "Product name too long in item " + (i + 1) + "." };
        }

        var unitPrice = Number(item.unitPrice);
        if (isNaN(unitPrice) || !Number.isFinite(unitPrice) || unitPrice < 0) {
            return { error: "Invalid unit price in item " + (i + 1) + "." };
        }

        var quantity = Number(item.quantity);
        if (isNaN(quantity) || !Number.isFinite(quantity) || quantity < 1) {
            return { error: "Invalid quantity in item " + (i + 1) + ". Must be at least 1." };
        }
        if (!Number.isInteger(quantity)) {
            return { error: "Quantity must be a whole number in item " + (i + 1) + "." };
        }
    }

    if (!deliveryInfo || typeof deliveryInfo !== "object") {
        return { error: "Delivery information is required." };
    }

    var requiredDeliveryFields = ["fullName", "phone", "district", "sector", "cell", "village"];
    for (var j = 0; j < requiredDeliveryFields.length; j++) {
        var field = requiredDeliveryFields[j];
        if (!deliveryInfo[field] || typeof deliveryInfo[field] !== "string" || !deliveryInfo[field].trim()) {
            return { error: "Delivery " + field + " is required." };
        }
        if (deliveryInfo[field].length > 200) {
            return { error: "Delivery " + field + " is too long." };
        }
    }

    var phone = deliveryInfo.phone.replace(/[\s\-()]/g, "");
    if (!/^[0-9+]{7,15}$/.test(phone)) {
        return { error: "Invalid phone number format." };
    }

    return { value: { items: items, deliveryInfo: deliveryInfo } };
}

function validateStatusInput(body, allowedStatuses) {
    var status = body && body.status;
    if (!status || typeof status !== "string") {
        return { error: "Status is required." };
    }
    if (!allowedStatuses.includes(status)) {
        return { error: "Invalid status. Must be one of: " + allowedStatuses.join(", ") };
    }
    return { value: { status: status } };
}

function validateObjectId(param, paramName) {
    if (!isValidObjectId(param)) {
        return { error: "Invalid " + (paramName || "ID") + " format." };
    }
    return { value: param };
}

function validateProfileInput(body) {
    var name = stripHtml(body && body.name);
    var phone = sanitizeText(body && body.phone);
    var address = stripHtml(body && body.address);
    var bio = stripHtml(body && body.bio);

    if (!name || name.length < 2) {
        return { error: "Name must be at least 2 characters long." };
    }

    if (name.length > 50) {
        return { error: "Name must be 50 characters or less." };
    }

    if (phone && phone.length > 20) {
        return { error: "Phone number must be 20 characters or less." };
    }

    if (phone && !/^[0-9+\s\-()]{7,20}$/.test(phone)) {
        return { error: "Please provide a valid phone number." };
    }

    if (address && address.length > 200) {
        return { error: "Address must be 200 characters or less." };
    }

    if (bio && bio.length > 500) {
        return { error: "Bio must be 500 characters or less." };
    }

    return {
        value: {
            name: name,
            phone: phone || "",
            address: address || "",
            bio: bio || ""
        }
    };
}

function validatePasswordChangeInput(body) {
    var currentPassword = typeof (body && body.currentPassword) === "string" ? body.currentPassword : "";
    var newPassword = typeof (body && body.newPassword) === "string" ? body.newPassword : "";
    var confirmPassword = typeof (body && body.confirmPassword) === "string" ? body.confirmPassword : "";

    if (!currentPassword) {
        return { error: "Current password is required." };
    }

    if (!newPassword) {
        return { error: "New password is required." };
    }

    if (newPassword.length < 8) {
        return { error: "New password must be at least 8 characters long." };
    }

    if (newPassword.length > 128) {
        return { error: "New password must be 128 characters or less." };
    }

    if (!/[A-Z]/.test(newPassword)) {
        return { error: "New password must contain at least one uppercase letter." };
    }

    if (!/[a-z]/.test(newPassword)) {
        return { error: "New password must contain at least one lowercase letter." };
    }

    if (!/[0-9]/.test(newPassword)) {
        return { error: "New password must contain at least one number." };
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
        return { error: "New password must contain at least one special character." };
    }

    if (newPassword === currentPassword) {
        return { error: "New password must be different from current password." };
    }

    if (newPassword !== confirmPassword) {
        return { error: "Confirm password does not match new password." };
    }

    return {
        value: {
            currentPassword: currentPassword,
            newPassword: newPassword
        }
    };
}

module.exports = {
    sanitizeText,
    stripHtml,
    normalizeEmail,
    isValidEmail,
    isValidObjectId,
    validateAuthInput,
    validateSignupInput,
    validateProductInput,
    validateContactInput,
    validateOrderInput,
    validateStatusInput,
    validateObjectId,
    validateProfileInput,
    validatePasswordChangeInput,
    MONGO_OBJECTID_REGEX,
    ALLOWED_PRODUCT_CATEGORIES,
    ALLOWED_PAYMENT_METHODS,
    ORDER_STATUSES,
    FARMER_ORDER_STATUSES,
    USER_ROLES
};
