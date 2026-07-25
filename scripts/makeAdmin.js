const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

async function makeAdmin() {

    try {

        await mongoose.connect(process.env.MONGO_URI);

        const email = process.argv[2];

        if (!email) {
            console.log("Usage:");
            console.log("node scripts/makeAdmin.js your@email.com");
            process.exit();
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            console.log("User not found.");
            process.exit();
        }

        user.role = "admin";

        await user.save();

        console.log("=================================");
        console.log("✓ User promoted successfully");
        console.log("Name :", user.name);
        console.log("Email:", user.email);
        console.log("Role :", user.role);
        console.log("=================================");

        process.exit();

    } catch (err) {

        console.error(err);

        process.exit(1);

    }

}

makeAdmin();