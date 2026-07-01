const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  });

  const users = await User.find({}).lean();
  let updated = 0;
  let skipped = 0;
  let alreadyNormalized = 0;

  for (const user of users) {
    const originalEmail = typeof user.email === 'string' ? user.email : '';
    const normalizedEmail = originalEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      skipped += 1;
      continue;
    }

    if (normalizedEmail === originalEmail) {
      alreadyNormalized += 1;
      continue;
    }

    const existingDuplicate = await User.findOne({
      _id: { $ne: user._id },
      email: normalizedEmail
    }).lean();

    if (existingDuplicate) {
      console.log(`Skipping ${user._id}: normalized email already exists for ${existingDuplicate._id}`);
      skipped += 1;
      continue;
    }

    await User.updateOne({ _id: user._id }, { $set: { email: normalizedEmail } });
    updated += 1;
  }

  console.log(`Migration complete. Updated: ${updated}, already normalized: ${alreadyNormalized}, skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
