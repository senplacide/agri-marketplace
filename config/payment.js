const PLATFORM_COMMISSION_PERCENT = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) || 2;

const ORDER_STATUSES = [
    "Pending Payment",
    "Pending",
    "Paid",
    "Processing",
    "Shipped",
    "Completed",
    "Cancelled",
    "Refunded",
    "Accepted",
    "Rejected"
];

const PAYMENT_STATUSES = ["Unpaid", "Pending", "Paid", "Failed", "Refunded"];

const PAYMENT_METHODS = ["Card", "Mobile Money", "Bank Transfer", "DPO Pay", "Cash"];

module.exports = {
    PLATFORM_COMMISSION_PERCENT,
    ORDER_STATUSES,
    PAYMENT_STATUSES,
    PAYMENT_METHODS
};
