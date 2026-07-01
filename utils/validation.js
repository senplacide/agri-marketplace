const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PRODUCT_CATEGORIES = ["Fruits", "Vegetables", "Grains", "Livestock", "Equipment", "Other"];
const ALLOWED_PAYMENT_METHODS = ["Visa Card", "Mobile Money (MoMo)"];

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

function validateAuthInput(body) {
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidEmail(email)) {
    return { error: "Please provide a valid email address." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  return { value: { email, password } };
}

function validateSignupInput(body) {
  const name = sanitizeText(body?.name);
  const auth = validateAuthInput(body);

  if (auth.error) return auth;

  if (name.length > 50) {
    return { error: "Name must be 50 characters or less." };
  }

  return { value: { name, ...auth.value } };
}

function validateProductInput(body, { partial = false } = {}) {
  const name = sanitizeText(body?.name);
  const price = Number(body?.price);
  const category = sanitizeText(body?.category);
  const description = sanitizeText(body?.description);
  const contact = sanitizeText(body?.contact);
  const imageUrl = sanitizeText(body?.imageUrl);
  const paymentMethods = Array.isArray(body?.paymentMethods)
    ? body.paymentMethods.filter((value) => typeof value === "string" && value.trim())
    : [];

  if (!partial || body?.name !== undefined) {
    if (!name || name.length < 2) {
      return { error: "Product name must be at least 2 characters long." };
    }
  }

  if (!partial || body?.price !== undefined) {
    if (!Number.isFinite(price) || price < 0) {
      return { error: "Price must be a non-negative number." };
    }
  }

  if (!partial || body?.category !== undefined) {
    if (!ALLOWED_PRODUCT_CATEGORIES.includes(category)) {
      return { error: "Please choose a valid product category." };
    }
  }

  if (description && description.length > 1000) {
    return { error: "Description must be 1000 characters or less." };
  }

  if (!partial || body?.contact !== undefined) {
    if (!contact) {
      return { error: "Contact details are required." };
    }
  }

  if (imageUrl && !/^https?:\/\/\S+/i.test(imageUrl)) {
    return { error: "Image URL must start with http:// or https://" };
  }

  if (!partial || body?.paymentMethods !== undefined) {
    if (paymentMethods.length === 0) {
      return { error: "Please select at least one payment method." };
    }

    const invalidMethod = paymentMethods.find((method) => !ALLOWED_PAYMENT_METHODS.includes(method));
    if (invalidMethod) {
      return { error: "Invalid payment method selected." };
    }
  }

  return {
    value: {
      ...(name ? { name } : {}),
      ...(Number.isFinite(price) ? { price } : {}),
      ...(category ? { category } : {}),
      ...(description ? { description } : {}),
      ...(contact ? { contact } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(paymentMethods.length ? { paymentMethods } : {})
    }
  };
}

function validateContactInput(body) {
  const name = sanitizeText(body?.name);
  const email = sanitizeText(body?.email);
  const subject = sanitizeText(body?.subject);
  const message = sanitizeText(body?.message);

  if (!name || name.length < 2) {
    return { error: "Name must be at least 2 characters long." };
  }

  if (!isValidEmail(email)) {
    return { error: "Please provide a valid email address." };
  }

  if (!message || message.length < 10) {
    return { error: "Message must be at least 10 characters long." };
  }

  return {
    value: {
      name,
      email,
      subject: subject || "General Inquiry",
      message
    }
  };
}

module.exports = {
  sanitizeText,
  normalizeEmail,
  isValidEmail,
  validateAuthInput,
  validateSignupInput,
  validateProductInput,
  validateContactInput
};
