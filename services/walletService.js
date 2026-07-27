const Wallet = require("../models/Wallet");
const PlatformWallet = require("../models/PlatformWallet");
const WithdrawRequest = require("../models/WithdrawRequest");
const WalletTransaction = require("../models/WalletTransaction");
const { PLATFORM_COMMISSION_PERCENT } = require("../config/payment");

// ==========================================
// FARMER WALLET
// ==========================================

async function findOrCreateWallet(farmerId) {
    var wallet = await Wallet.findOne({ farmerId: farmerId });
    if (!wallet) {
        wallet = new Wallet({ farmerId: farmerId });
        await wallet.save();
    }
    return wallet;
}

async function getWalletByFarmerId(farmerId) {
    return Wallet.findOne({ farmerId: farmerId });
}

async function creditWallet(farmerId, amount, orderId) {
    if (!amount || amount <= 0) {
        throw new Error("Credit amount must be positive.");
    }

    var wallet = await Wallet.findOne({ farmerId: farmerId });
    if (!wallet) {
        throw new Error("Wallet not found for farmer: " + farmerId);
    }

    var balanceBefore = wallet.pendingBalance;
    wallet.pendingBalance += amount;
    wallet.totalEarned += amount;
    await wallet.save();

    await logTransaction({
        walletType: "farmer",
        walletId: wallet._id,
        userId: farmerId,
        orderId: orderId || null,
        type: "credit",
        amount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.pendingBalance,
        description: "Order payment credited to pending balance",
        status: "completed"
    });

    return wallet;
}

async function debitWallet(farmerId, amount, reason) {
    if (!amount || amount <= 0) {
        throw new Error("Debit amount must be positive.");
    }

    var wallet = await Wallet.findOne({ farmerId: farmerId });
    if (!wallet) {
        throw new Error("Wallet not found for farmer: " + farmerId);
    }

    if (wallet.availableBalance < amount) {
        throw new Error("Insufficient balance. Available: " + wallet.availableBalance);
    }

    var balanceBefore = wallet.availableBalance;
    wallet.availableBalance -= amount;
    wallet.totalWithdrawn += amount;
    await wallet.save();

    await logTransaction({
        walletType: "farmer",
        walletId: wallet._id,
        userId: farmerId,
        type: "debit",
        amount: -amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.availableBalance,
        description: reason || "Wallet debit",
        status: "completed"
    });

    return wallet;
}

async function releasePendingFunds(farmerId, amount) {
    if (!amount || amount <= 0) {
        throw new Error("Release amount must be positive.");
    }

    var wallet = await Wallet.findOne({ farmerId: farmerId });
    if (!wallet) {
        throw new Error("Wallet not found for farmer: " + farmerId);
    }

    if (wallet.pendingBalance < amount) {
        throw new Error("Insufficient pending balance. Pending: " + wallet.pendingBalance);
    }

    wallet.pendingBalance -= amount;
    wallet.availableBalance += amount;
    await wallet.save();

    return wallet;
}

// ==========================================
// PLATFORM WALLET
// ==========================================

async function findOrCreatePlatformWallet() {
    var wallet = await PlatformWallet.findOne({ isActive: true });
    if (!wallet) {
        wallet = new PlatformWallet({ label: "Platform Wallet", currency: "RWF" });
        await wallet.save();
    }
    return wallet;
}

async function creditPlatformWallet(amount, orderId, description) {
    if (!amount || amount <= 0) {
        throw new Error("Credit amount must be positive.");
    }

    var wallet = await findOrCreatePlatformWallet();
    var balanceBefore = wallet.availableBalance;
    wallet.availableBalance += amount;
    wallet.totalCommissionEarned += amount;
    await wallet.save();

    await logTransaction({
        walletType: "platform",
        walletId: wallet._id,
        userId: null,
        orderId: orderId || null,
        type: "commission",
        amount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.availableBalance,
        description: description || "Platform commission earned",
        status: "completed"
    });

    return wallet;
}

async function debitPlatformWallet(amount, description) {
    if (!amount || amount <= 0) {
        throw new Error("Debit amount must be positive.");
    }

    var wallet = await findOrCreatePlatformWallet();
    if (wallet.availableBalance < amount) {
        throw new Error("Insufficient platform balance. Available: " + wallet.availableBalance);
    }

    var balanceBefore = wallet.availableBalance;
    wallet.availableBalance -= amount;
    wallet.totalWithdrawn += amount;
    await wallet.save();

    await logTransaction({
        walletType: "platform",
        walletId: wallet._id,
        userId: null,
        type: "debit",
        amount: -amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.availableBalance,
        description: description || "Platform wallet debit",
        status: "completed"
    });

    return wallet;
}

async function getPlatformWallet() {
    return findOrCreatePlatformWallet();
}

// ==========================================
// WITHDRAW REQUESTS
// ==========================================

async function createWithdrawRequest(farmerId, amount, payoutMethod, payoutDetails) {
    if (!amount || amount <= 0) {
        throw new Error("Withdrawal amount must be positive.");
    }

    var wallet = await Wallet.findOne({ farmerId: farmerId });
    if (!wallet) {
        throw new Error("Wallet not found for farmer.");
    }

    if (wallet.availableBalance < amount) {
        throw new Error("Insufficient available balance. Available: " + wallet.availableBalance);
    }

    var requestId = "WD-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);

    var request = new WithdrawRequest({
        requestId: requestId,
        farmerId: farmerId,
        amount: amount,
        payoutMethod: payoutMethod || "Mobile Money",
        payoutDetails: payoutDetails || ""
    });

    await request.save();

    await logTransaction({
        walletType: "farmer",
        walletId: wallet._id,
        userId: farmerId,
        withdrawRequestId: request._id,
        type: "withdrawal",
        amount: -amount,
        balanceBefore: wallet.availableBalance,
        balanceAfter: wallet.availableBalance,
        description: "Withdrawal request submitted: " + requestId,
        status: "pending"
    });

    return request;
}

async function approveWithdrawal(requestId, adminId, adminNote) {
    var request = await WithdrawRequest.findOne({ requestId: requestId });
    if (!request) {
        throw new Error("Withdraw request not found.");
    }

    if (request.status !== "pending") {
        throw new Error("Request has already been " + request.status + ".");
    }

    var wallet = await Wallet.findOne({ farmerId: request.farmerId });
    if (!wallet) {
        throw new Error("Farmer wallet not found.");
    }

    if (wallet.availableBalance < request.amount) {
        throw new Error("Insufficient balance. Available: " + wallet.availableBalance);
    }

    var balanceBefore = wallet.availableBalance;
    wallet.availableBalance -= request.amount;
    wallet.totalWithdrawn += request.amount;
    await wallet.save();

    request.status = "approved";
    request.processedBy = adminId;
    request.processedAt = new Date();
    request.adminNote = adminNote || "";
    await request.save();

    await logTransaction({
        walletType: "farmer",
        walletId: wallet._id,
        userId: request.farmerId,
        withdrawRequestId: request._id,
        type: "withdrawal",
        amount: -request.amount,
        balanceBefore: balanceBefore,
        balanceAfter: wallet.availableBalance,
        description: "Withdrawal approved: " + requestId,
        status: "completed"
    });

    return request;
}

async function rejectWithdrawal(requestId, adminId, adminNote) {
    var request = await WithdrawRequest.findOne({ requestId: requestId });
    if (!request) {
        throw new Error("Withdraw request not found.");
    }

    if (request.status !== "pending") {
        throw new Error("Request has already been " + request.status + ".");
    }

    request.status = "rejected";
    request.processedBy = adminId;
    request.processedAt = new Date();
    request.adminNote = adminNote || "";
    await request.save();

    return request;
}

async function getWithdrawRequests(farmerId, status) {
    var query = {};
    if (farmerId) query.farmerId = farmerId;
    if (status) query.status = status;
    return WithdrawRequest.find(query).populate("farmerId", "name email").sort({ createdAt: -1 });
}

// ==========================================
// WALLET TRANSACTIONS
// ==========================================

async function logTransaction(data) {
    var txnId = "TXN-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
    return WalletTransaction.create({
        transactionId: txnId,
        walletType: data.walletType,
        walletId: data.walletId || null,
        userId: data.userId || null,
        orderId: data.orderId || null,
        withdrawRequestId: data.withdrawRequestId || null,
        type: data.type,
        amount: data.amount,
        balanceBefore: data.balanceBefore || 0,
        balanceAfter: data.balanceAfter || 0,
        description: data.description || "",
        status: data.status || "completed"
    });
}

async function getWalletTransactions(walletType, userId, limit) {
    var query = {};
    if (walletType) query.walletType = walletType;
    if (userId) query.userId = userId;
    return WalletTransaction.find(query).sort({ createdAt: -1 }).limit(limit || 50);
}

// ==========================================
// ORDER COMMISSION PROCESSING
// ==========================================

async function processOrderCommission(order) {
    if (!order || !order.commissionAmount) return null;

    if (order.commissionAmount > 0) {
        await creditPlatformWallet(
            order.commissionAmount,
            order._id,
            "Commission from order " + order.orderId
        );
    }

    var farmerAmount = order.farmerAmount || (order.totalPrice - order.commissionAmount);
    if (farmerAmount > 0) {
        var farmerId = null;
        if (order.items && order.items.length > 0) {
            var Product = require("../models/Product");
            var firstProduct = await Product.findById(order.items[0].product);
            if (firstProduct) farmerId = firstProduct.owner;
        }
        if (farmerId) {
            await creditWallet(farmerId, farmerAmount, order._id);
        }
    }

    return true;
}

module.exports = {
    findOrCreateWallet,
    getWalletByFarmerId,
    creditWallet,
    debitWallet,
    releasePendingFunds,
    findOrCreatePlatformWallet,
    creditPlatformWallet,
    debitPlatformWallet,
    getPlatformWallet,
    createWithdrawRequest,
    approveWithdrawal,
    rejectWithdrawal,
    getWithdrawRequests,
    logTransaction,
    getWalletTransactions,
    processOrderCommission
};
