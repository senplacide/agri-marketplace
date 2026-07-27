const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const walletService = require("../services/walletService");

const router = express.Router();

/*
==================================================
GET FARMER WALLET INFO
==================================================
*/

router.get("/wallet", requireAuth, async function (req, res) {
    try {
        var wallet = await walletService.findOrCreateWallet(req.userId);
        var transactions = await walletService.getWalletTransactions("farmer", req.userId, 30);
        var pendingRequests = await walletService.getWithdrawRequests(req.userId, "pending");

        res.json({
            success: true,
            data: {
                wallet: wallet,
                transactions: transactions,
                pendingRequests: pendingRequests
            }
        });
    } catch (err) {
        console.error("[Farmer Wallet] Fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to load wallet.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
SUBMIT WITHDRAWAL REQUEST
==================================================
*/

router.post("/wallet/withdraw", requireAuth, async function (req, res) {
    try {
        var amount = parseFloat(req.body.amount);
        var payoutMethod = req.body.payoutMethod || "Mobile Money";
        var payoutDetails = req.body.payoutDetails || "";

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Please enter a valid withdrawal amount."
            });
        }

        var validMethods = ["Mobile Money", "Bank Transfer", "Cash"];
        if (validMethods.indexOf(payoutMethod) === -1) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                error: "Invalid payout method."
            });
        }

        var wallet = await walletService.findOrCreateWallet(req.userId);
        if (wallet.availableBalance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance.",
                error: "Available balance: " + wallet.availableBalance + " RWF. Requested: " + amount + " RWF."
            });
        }

        var user = await User.findById(req.userId);
        if (payoutMethod === "Mobile Money" && !payoutDetails && !user.momoNumber) {
            return res.status(400).json({
                success: false,
                message: "Payout details required.",
                error: "Please provide a Mobile Money number."
            });
        }

        var request = await walletService.createWithdrawRequest(req.userId, amount, payoutMethod, payoutDetails);

        var updatedWallet = await walletService.findOrCreateWallet(req.userId);

        res.status(201).json({
            success: true,
            message: "Withdrawal request submitted.",
            data: {
                request: request,
                wallet: updatedWallet
            }
        });
    } catch (err) {
        console.error("[Farmer Wallet] Withdraw error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to submit withdrawal request.",
            error: "An unexpected error occurred."
        });
    }
});

/*
==================================================
GET WITHDRAWAL HISTORY
==================================================
*/

router.get("/wallet/withdrawals", requireAuth, async function (req, res) {
    try {
        var requests = await walletService.getWithdrawRequests(req.userId);
        res.json({
            success: true,
            data: requests
        });
    } catch (err) {
        console.error("[Farmer Wallet] Withdrawals fetch error:", err.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch withdrawal history.",
            error: "An unexpected error occurred."
        });
    }
});

module.exports = router;
