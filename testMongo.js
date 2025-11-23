const mongoose = require("mongoose");

const uri = "mongodb+srv://placidesenadata35_db_user:YIoNfkTdY0xRfALh@cluster30.cmyolwl.mongodb.net/agri-marketplace?retryWrites=true&w=majority";

mongoose.set("strictQuery", false);

(async () => {
  try {
    console.log("🔍 Trying to connect to MongoDB...");
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ Connected successfully!");
    await conn.disconnect();
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  }
})();
