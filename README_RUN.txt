========================================
          🌾 AGRICONNECT APP
========================================

A simple marketplace platform that connects farmers and buyers.
Built with:
- Node.js + Express (backend)
- MongoDB Atlas (database)
- HTML, CSS, JS (frontend)

----------------------------------------
1️⃣  REQUIREMENTS
----------------------------------------
Before running, make sure you have installed:
- Node.js (v18 or higher)
- npm (comes with Node)
- A web browser (Chrome, Edge, or Firefox)
- Internet connection (for MongoDB Atlas)

----------------------------------------
2️⃣  INSTALL DEPENDENCIES
----------------------------------------
In VS Code terminal, navigate to your project folder and run:

    npm install

This will install all required modules such as:
express, mongoose, dotenv, cors, bcryptjs, jsonwebtoken, etc.

----------------------------------------
3️⃣  SETUP ENVIRONMENT VARIABLES
----------------------------------------
Create a file named `.env` in your main folder (same level as server.js)
and copy the following into it:

    MONGO_URI=mongodb+srv://placidesenadata35_db_user:8zSAP0yX9NeaYnhw@cluster30.cmyolwl.mongodb.net/agri-marketplace?retryWrites=true&w=majority
    PORT=5000
    JWT_SECRET=159984ee217908809efb01530ae978a50f67871b7e2c1625bd8a555667b703d5fb3aa1e62574a34a616a93b645b91322afbba914bb9d9936a9538322524e3892
    JWT_EXPIRES_IN=7d

----------------------------------------
4️⃣  START THE SERVER
----------------------------------------
Run one of the following commands in terminal:

To start normally:
    node server.js

To start with auto reload (recommended for development):
    npx nodemon server.js

You should see a message like:
    ✅ MongoDB connected
    🚀 Server running on http://localhost:5000

----------------------------------------
5️⃣  OPEN IN BROWSER
----------------------------------------
Go to your browser and open:
    http://localhost:5000

You should now see the AgriConnect homepage.

----------------------------------------
6️⃣  PROJECT STRUCTURE (IMPORTANT FILES)
----------------------------------------
agri-marketplace/
│
├── server.js
├── .env
├── package.json
├── models/
│   └── User.js
│   └── Product.js
├── routes/
│   └── auth.js
│   └── products.js
├── public/
│   ├── index.html
│   ├── items.html
│   ├── about.html
│   ├── contact.html
│   ├── auth.html
│   ├── style.css
│   └── script.js
└── README_RUN.txt

----------------------------------------
7️⃣  NOTES
----------------------------------------
- If you get “Cannot find module” errors, run again:
      npm install bcryptjs jsonwebtoken cors dotenv mongoose express
- Make sure your MongoDB Atlas database is active and your URI is correct.
- Press CTRL + C in terminal to stop the server.

----------------------------------------
8️⃣  TROUBLESHOOTING & COMMON ERRORS
----------------------------------------

🔹 **1. Authentication Failed (MongoDB)**
   - Cause: Wrong username or password in `.env`
   - Fix: Update your MONGO_URI with correct user credentials from MongoDB Atlas.

🔹 **2. “Cannot find module ...” Error**
   - Fix: Reinstall all dependencies
         npm install

🔹 **3. Nodemon not recognized**
   - Fix:
         npm install -g nodemon

🔹 **4. Port already in use**
   - Fix:
         npx kill-port 5000
         OR restart VS Code terminal

🔹 **5. App not loading images or CSS**
   - Fix:
         Make sure all static files (images, style.css, script.js) are in the /public folder
         and this line exists in `server.js`:
             app.use(express.static(path.join(__dirname, "public")));

🔹 **6. Clear npm cache if errors continue**
   - Run:
         npm cache clean --force
         npm install

🔹 **7. “MongoNetworkError”**
   - Cause: Poor internet connection or blocked MongoDB access
   - Fix:
         Ensure stable connection and that your IP is whitelisted in MongoDB Atlas.

----------------------------------------
💚 THANK YOU FOR USING AGRICONNECT
----------------------------------------
Developed by: Placide Sen  
Email: support@agriconnect.africa  
Version: 1.0.0
========================================
