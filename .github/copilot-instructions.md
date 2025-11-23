## Quick context for AI coding agents

This is a small Node.js + Express + MongoDB app (AgriConnect). Keep guidance concise and specific to this repo.

- Entry point: `server.js` — sets up Express, connects to MongoDB using `process.env.MONGO_URI`, serves static files from `public/`, and mounts API routers under `/api`.
- API routers: `routes/auth.js` (`/api/auth`) and `routes/products.js` (`/api/products`). Use these files to understand auth flow and product CRUD.
- Models: `models/User.js` and `models/Product.js` (Mongoose schemas with `timestamps: true`). `Product.owner` references `User` and handlers often `populate("owner", "name email")`.

Important patterns and conventions
- Auth: JWT tokens are created in `routes/auth.js` with payload `{id, email}` and signed using `process.env.JWT_SECRET` (fallback `dev_secret`).
  - Protected endpoints use Authorization header: `Authorization: Bearer <token>`; the `requireAuth` middleware in `routes/products.js` expects that format and sets `req.userId`.
  - Passwords are stored as `passwordHash` (bcrypt, salt rounds = 10). When adding auth features, follow the same field names.

- Error handling: route handlers return JSON errors using `{ error: <message> }` and appropriate HTTP status codes (400/401/403/404/500). Follow this shape when adding endpoints or client-facing messages.

- Static front-end: `public/` contains the HTML/JS/CSS UI. `server.js` serves page routes explicitly (`/`, `/items`, `/about`, `/contact`, `/auth`, `/dashboard`) in addition to `express.static`.

Developer workflows (discoverable)
- Install: `npm install` (see `package.json`).
- Start: `npm start` → `node server.js`. Dev with auto-reload: `npm run dev` (nodemon)
- Environment: repository expects a `.env` with `MONGO_URI`, `PORT`, `JWT_SECRET`, and optional `JWT_EXPIRES_IN`. See `README_RUN.txt` for example values — treat any secrets in that file as sensitive; replace with your own for development.

Data flow highlights
- Signup: `POST /api/auth/signup` creates a `User` with `passwordHash`, returns `{ token, user }`.
- Signin: `POST /api/auth/signin` verifies `passwordHash` and returns `{ token, user }`.
- Products: `GET /api/products` returns products populated with owner info; `POST /api/products` requires auth and sets `owner = req.userId`; `DELETE /api/products/:id` enforces owner check.

When editing code
- Keep API shapes stable: prefer returning JSON `{ error: string }` on failure and the created/updated resource on success.
- When changing the auth payload or model fields, update both router logic and any frontend usage in `public/script.js` (search for `/api/` calls).
- Avoid hardcoding secrets; use `process.env` variables. Note that route files fall back to `dev_secret` if `JWT_SECRET` is missing — update cautiously.

Examples (use these patterns when generating code):
- Authorization header usage (JS fetch):
  fetch('/api/products', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(product) })
- Error response pattern:
  res.status(400).json({ error: 'Email and password required' })

Files to inspect first for context
- `server.js`, `routes/auth.js`, `routes/products.js`, `models/User.js`, `models/Product.js`, `public/script.js`, `README_RUN.txt`.

Do NOT do by default
- Replace or check in real credentials (the README_RUN contains an example URI and JWT values). Treat them as placeholders — do not commit real secrets.

If you need clarification
- Ask which env values to use for local development (MONGO_URI and JWT_SECRET). Also ask if changes should update the static `public/` client or only the API.

If you modify API contracts
- Update README_RUN.txt or add a short note in `README.md` describing the change so future agents can find it quickly.
