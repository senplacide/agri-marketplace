# AgriConnect — Production-Readiness UAT Report (Updated)

**App under test:** https://agri-marketplace-api.onrender.com (Render) vs local http://127.0.0.1:5000
**Repo:** `agri-marketplace` (branch `main`)
- Deployed commit: `7428587` (last commit pushed to Render)
- Local working tree: `7428587` + uncommitted fixes (14 files changed) — these fixes are **NOT deployed**
**Dates:** 11 Aug 2026 (baseline) · **14 Aug 2026 (this update)**
**Method:** Black-box UAT via live HTTP side-by-side (LOCAL vs DEPLOYED) + read-only DB verification. No application code changed during this audit.
**Critical environment fact:** Local and deployed **share the same production MongoDB** (`agri-marketplace`). Every account/order/product created during this audit exists in BOTH environments. Envs also have **different JWT_SECRETs** (tokens are not interchangeable; per-env login was required).

---

## A. Executive Summary

**Verdict: DEPLOYED — NOT PRODUCTION-READY. LOCAL (working tree) — FUNCTIONAL, but still NOT production-ready** (payments absent; email only works from the dev machine; shared-prod-DB and secrets issues unresolved).

The uncommitted local working tree fixes nearly every CRITICAL/HIGH bug found in the 11 Aug baseline — all verified live this run (role enforcement → 403, buyer self-complete → 400, stock decrement + oversell → 400, wallet mounted + commission processed + withdrawal flow end-to-end, notifications created, deleted-user JWT → 401, resend/forgot-password fixed). **None of these fixes are on Render.** The deployed app reproduces every baseline bug, plus new confirmations (see G below).

Remaining blockers in BOTH environments:
1. **No payments** — checkout has no payment step; `paymentStatus` stays `Pending`/`Unpaid` forever. DPO/MoMo strings exist, no gateway code.
2. **Email delivery is host-dependent** — works only when the app runs on the dev machine (Brevo SMTP reachable); from Render, all email-bearing requests block 30–63 s and **no email is ever sent**. This breaks signup verification, all transactional notifications, and the contact form on the live site.
3. **Notification center endpoint does not exist** — `routes/notifications.js` exists but is never mounted in `server.js` (both envs) → `/api/notifications` and `/api/notifications/unread-count` return 404. Notifications are created in DB (local) but the UI only shows them via a localStorage fallback that never receives server data.

---

## B. Scope & Environment

### Test accounts (verified, created for this audit)
| Env | Role | Email |
|---|---|---|
| deployed | Buyer | `agcauditd-buyer-1786696187554@emalupe.com` |
| deployed | Farmer | `agcauditd-farmer-178669675558868@emalupe.com` |
| deployed | Admin (temp) | `agcaudit-admin-1786696830404@emalupe.com` |
| local | Buyer | `agcauditl-buyer-1786696617397@emalupe.com` |
| local | Farmer | `agcauditl-farmer-178669682240860@emalupe.com` |

### Test records created
- Products: `UAT Audit Maize D` (deployed, `6a7ed49c82800ff6f8956c16`) and `UAT Audit Maize L` (local, `6a7ed4d3c96d94da286cd832`), both approved; `UAT Reject Me` (rejected) ×2.
- Orders: deployed `ORD-1786697000120-1wkzw9` (buyer self-PATCHed; DB final = **Cancelled**), deployed `ORD-1786697667776-umblzl` (legit farmer complete), local `ORD-1786697116583-56d55e` (completed, commission processed), local `ORD-1786697909972-r1th22` (completed). One deployed oversell order (qty 999) was created as evidence then **deleted** from DB.
- Withdrawal request (local): `WD-1786697494944-ro141p` — created + approved by admin.
- Notifications: 4 (buyer), 2 (farmer) on local only. Wallet docs + transactions (local) only.

> **Test artifacts REMAIN in the shared production DB** (2 maize products, 4 orders, notifications, wallets, withdrawal record, temp admin user, 1 extra unverified user from resend test, `UAT Reject Me` products). Admin should delete these before launch. Legacy pre-existing UAT users `agc-uat-buyer-001/002@maildrop.cc` (unverified, expired codes) are **not** deleted.

---

## C. Registration & Verification (Phase A)

| Test | LOCAL | DEPLOYED |
|---|---|---|
| Signup (fresh email) | 201 in **7.9 s** | 201 in **63.7 s** |
| Verification email arrives? | **Yes** (~8 s, Brevo sender `placidesenata35@11428591.brevosend.com`, subject "Verify your AgriConnect account", code 348890) | **No — never arrives** |
| Login before verify | 403 | 403 |
| Wrong verification code | 400 | 400 |
| DB-code verification | 200 | 200 |
| Resend code | 200 (fresh code issued) | **500 after 30.6 s — BUT code actually rotates in DB** (607409→779049, expiry extended). User sees failure; action succeeded. |
| Forgot-password, non-existent email | 200 (fast, no enumeration) | 200 (fast, no enumeration) |
| Forgot-password, real user | 200 (email sent) | **500 after 30.6 s — BUT `resetPasswordCode` saved (999044)** |
| Legacy pending user (expired code) | verify 400, login 401 | verify 400, login 401 |

**Registration verdict:** Flow is correct and secure (no enumeration, code validation, verified gate). The deployed instance cannot deliver email, so real users can never activate accounts there.

---

## D. Buyer Findings (Phases B + F)

| Test | LOCAL | DEPLOYED |
|---|---|---|
| Order placement | 201 in ~6–7 s | 201 in **61.8 s** |
| Order item `farmerName` | Correct farmer name | **"Unknown Farmer"** (route reads non-existent `dbProduct.farmerName`) |
| Stock decrement at order | **Yes** (15→13→12) | **No** (15 stays 15) |
| Oversell protection | **400 "Only 12 unit(s)… Requested: 999"** | **No check — qty-999 order CREATED (201)**; request blocks ~60 s on farmer email |
| Buyer PATCH own order status | **400 "Must be one of: Cancelled"** (only cancellable) | **200 — any status** (Completed / Cancelled / etc.) |
| Notifications on order events | **Created** (buyer: 4 = order_accepted ×2 + order_completed ×2; farmer: 2 = new_order ×2) | **Never created** (buyer 0, farmer 0 — even on legitimate farmer accept→complete) |
| `/api/analytics/buyer` | 200, 333 ms | 200, 630 ms |
| Notifications center | `/api/notifications` **404** (router not mounted); UI falls back to localStorage → empty | same 404 + empty |
| Contact form | 200 in **4.2 s** "Message sent and saved." | 200 in **30.5 s** "Message saved, but email alert failed." |

**Buyer verdict:** Ordering works on both, but deployed has zero inventory control, wrong seller attribution, self-complete privilege, and no notifications. Local is correct on all of these.

---

## E. Farmer Findings (Phase C)

| Test | LOCAL | DEPLOYED |
|---|---|---|
| Create product | 201 (pending) | 201 (pending) |
| Pending product visible in marketplace | No | No |
| Admin approve | 200 in **4.4 s** | 200 in **31 s** (email block) |
| Product visible after approval | Yes | Yes |
| Product detail owner name | Populated | Populated |
| Farmer wallet endpoint `/api/wallet` | **200** (mounted) | **404** (not mounted) |
| `/api/analytics/farmer` | 200, 776 ms, totalSales 7500, completedOrders 2 | 200, 964 ms, totalSales 7500, completedOrders 1 |
| **Wallet / payout** | **Fully works:** order 5000 → farmer 4900, platform 100 commission; withdrawal 2000 requested → approved → available 2900, totalWithdrawn 2000; 4 wallet transactions | **Dead code:** wallet never credited, no transactions, no PlatformWallet |

**Farmer verdict:** Listing/approval flow works both envs. Earning money only works locally; on deployed a farmer can sell but never receives anything (no wallet mount, no commission processing).

---

## F. Admin Findings (Phase D)

| Test | Result |
|---|---|
| Dashboard / users / products / orders / financial / audit-logs | 200 with data, **consistent across both envs** (users 14, pending 3: 2 legacy maildrop + 1 from resend test) |
| Product approve / reject | Works both envs; rejected product correctly not visible in marketplace (cross-env impact verified) |
| User suspend / unsuspend | Works: blocks login + existing-token API while suspended (403 both envs) |
| Withdrawal approve | Local: full chain verified (see E). Deployed: no withdrawals possible (no wallet) |
| Audit logs | 21 logs, both envs |

**Admin verdict:** Admin suite is solid. One data bug: **`outOfStockProducts` under-reports** — the `beans` product has **no `quantity` field** in DB (mongoose default 0 applied at hydration, so API shows qty 0), and the dashboard counts `{quantity: 0}` which misses the missing field → reports 0 out-of-stock despite an effectively zero-stock approved product. Same code both envs; data-quality issue.

---

## G. Authorization & Security (Phases E + H4) — LOCAL vs DEPLOYED

| Test | LOCAL | DEPLOYED |
|---|---|---|
| No token on protected routes | 401 | 401 (except `/api/wallet` → 404) |
| Buyer/farmer token on admin routes | 403 | 403 |
| **Buyer token on farmer routes** (`farmer/orders`, `farmer/dashboard`, `analytics/farmer`, `my-listings`) | **403 (fixed)** | **200 — buyer can act as farmer** |
| Buyer token → `POST /api/products` | **403 (fixed)** | **201 — any user can list products** |
| Buyer PATCH own order status | 400 (restricted) | 200 (any status) |
| Deleted user + valid JWT → `/api/farmer/orders` | **401 (fixed)** | **200 — deleted user keeps access** |
| Deleted user + valid JWT → `/api/auth/me` | 404 | 404 |
| Suspended user + valid JWT | 403 | 403 |
| Login rate limiting | — | 12 rapid attempts → 6×401 then 6×429 |
| Security headers | helmet CSP, HSTS, nosniff, `frame-ancestors 'none'` (+minor `X-Frame-Options: SAMEORIGIN` contradiction) | same |
| Error leakage | generic 400/404, no stack traces | same |

**Security verdict:** Local working tree is hardened. Deployed is wide open on role checks, order-status, and deleted-user access. Shipping the working tree fixes these; shipping `7428587` ships the holes.

---

## H. Local vs Deployed — Difference Summary

| Area | Deployed `7428587` | Local working tree |
|---|---|---|
| `requireFarmer` on farmer/product routes | ✗ buyer gets 200/201 | ✓ 403 |
| Buyer order-status PATCH | ✗ any status | ✓ Cancelled-only |
| Stock check + decrement | ✗ none | ✓ decrement + oversell 400 |
| Wallet mount `/api/wallet` | ✗ 404 | ✓ works |
| Commission processing on complete | ✗ none | ✓ farmer 4900 / platform 100 |
| Withdrawal lifecycle | ✗ impossible | ✓ full chain |
| Notifications created | ✗ 0 (even on legit complete) | ✓ created (only reachable via DB/localStorage — API 404) |
| Deleted-user JWT | ✗ leaks into `requireAuthWithUser` routes | ✓ 401 |
| resend-code / forgot-password | ✗ 500 after 30 s (side effects still applied) | ✓ 200 |
| Email delivery | ✗ never (30–63 s timeouts) | ✓ from dev machine (~4–8 s) |
| `/api/notifications` | ✗ 404 (not mounted) | ✗ 404 (not mounted) — SAME |

---

## I. Findings by Severity

### CRITICAL (block release)
**C1. No payments (both envs).** No gateway code; `paymentStatus` never leaves `Pending`/`Unpaid`; "Pay/Paid/Failed" are labels only. No money moves anywhere.
**C2. Email broken on deployed (both, host-dependent).** All email-bearing requests block 30–63 s and no email is sent → signup verification, notifications, contact form dead on the live site. Only the dev machine can send mail.
**C3. Deployed has no inventory system.** Oversell qty-999 order created (201); stock never decremented. (Local fixed → 400 + decrement.)
**C4. Deployed wallet/commission is dead code.** Wallet not mounted (404), no commission, no payout. (Local fixed and verified end-to-end.)

### HIGH
**H1. Deployed role enforcement missing.** Buyer token → farmer endpoints 200, product creation 201. (Local: 403.)
**H2. Deployed buyer self-completes orders.** Buyer PATCH own order → 200 any status. (Local: 400.)
**H3. Deployed deleted-user JWT keeps API access** via `requireAuth` fall-through (and the `requireAuthWithUser` variant leaks on `/api/farmer/orders`). (Local: 401.)
**H4. Deployed notification creation coupled to email success** — never fires. (Local: created, but see H5.)
**H5. Notification API not mounted (both envs).** Router exists, server.js never mounts it → 404; UI degrades to empty localStorage fallback.
**H6. Deployed wrong seller attribution** — items always `farmerName: "Unknown Farmer"`. (Local: correct.)

### MEDIUM
**M1. No stock display in UI (both).** Product detail (`item.html`) shows no quantity/stock; marketplace cards show none; only an "In Stock Only" toggle exists. Buyer cannot see availability before ordering.
**M2. Side-effect desync on deployed** — resend-code and forgot-password return 500 but still apply DB changes (code rotation, reset-code saved). Client may retry and rotate codes repeatedly.
**M3. Out-of-stock reporting bug (both).** `beans` product missing `quantity` field; `countDocuments({quantity:0})` under-reports.
**M4. Performance (deployed).** Email-blocked endpoints 30–63 s; public pages 0.28–1.06 s; local pages 7–257 ms.
**M5. Not internationalized (both).** Rwanda-specific titles, phone, districts, RWF-primary pricing with hard-coded 1400 rate.
**M6. Checkout validation friction (both).** Phone must match `^[0-9]{10,12}$` → Rwandan `+250…` numbers rejected (user must strip `+250`); no pre-payment/payment selection UI.
**M7. Shared production DB across environments.** Running the local dev server writes real users/orders into production data; different JWT secrets across envs complicate cross-testing.

### LOW / POSITIVE
**L1.** AuthN correct: 401 no-token, 403 non-admin, 403 suspended (both envs).
**L2.** Rate limiting (429) + no stack leakage + helmet headers (both).
**L3.** Admin suite fully functional (dashboard/users/products/orders/financial/withdrawals/audit-logs) both envs; suspend/unsuspend works.
**L4.** Farmer create→approve→sell loop, buyer order→farmer accept→complete, analytics (farmer/buyer/admin), withdrawal review — all verified working locally.
**L5.** No email enumeration on forgot-password (both).

---

## J. Live Test Evidence (selected, this run)

| Test | LOCAL | DEPLOYED |
|---|---|---|
| `POST /api/orders` (normal) | 201, 6.8 s | 201, 62.8 s |
| `POST /api/orders` qty 999 | **400** "Only 12 unit(s)…" | **201 created** (order deleted after) |
| Product stock after order | decremented (15→13→12) | unchanged (15) |
| Farmer accept → complete | 200, 3.2 s / 4.9 s | 200, 31.4 s / 31.5 s |
| Farmer wallet after complete | 4900 earned / platform 100 | 0 / no PlatformWallet |
| Withdraw 2000 → admin approve | available 2900, withdrawn 2000 | n/a (no wallet) |
| Buyer PATCH own order → Completed | 400 | 200 (DB final: Cancelled) |
| Buyer token → `GET /api/farmer/orders` | 403 | 200 |
| Buyer token → `POST /api/products` | 403 | 201 |
| Deleted user JWT → `/api/farmer/orders` | 401 | 200 |
| `GET /api/notifications/unread-count` | 404 | 404 |
| `GET /api/wallet` | 200 (401 no-token) | 404 |
| Contact form | 200, 4.2 s (sent) | 200, 30.5 s (email alert failed) |
| Signup | 201, 7.9 s, email delivered | 201, 63.7 s, email never arrives |
| Resend code | 200 | 500 at 30.6 s (code rotated anyway) |

---

## K. Recommended Fixes (priority order)

1. **Deploy the working tree** — it contains fixes for every deployed security/inventory/wallet/notification bug found. Then re-run this suite against Render.
2. **Email:** replace blocking SMTP-in-handler with an email API (Brevo/SendGrid HTTP) using short timeouts + out-of-band queue; verify on Render with a real inbox (mail.tm works; maildrop.cc is dead).
3. **Mount `/api/notifications`** in `server.js`; then notification-center.js works for real (DB already contains notifications).
4. **Payments:** decide COD vs gateway; wire `paymentStatus` transitions; only allow Paid orders (or COD flag) to be completed.
5. **Seed the catalog** (1 approved qty-0 `beans` product + a missing `quantity` field is not a marketplace) and fix the `outOfStockProducts` count.
6. **Decide env isolation:** don't run the dev server against production Mongo; use a staging DB.
7. **i18n + checkout polish:** parameterize copy/currency/phone validation (`+250` accepted).

---

## L. Open Questions for the Product Owner
- Payment model: COD or gateway (DPO live vs test)? Commission 2% on completed orders — auto-payout or manual approve (withdraw flow already exists)?
- Who seeds the catalog for launch, and how do stock levels get maintained (farmer-managed vs central)?
- Target market: Rwanda-only (keep RWF copy, fix catalog) or multi-country (i18n)?
- Should the deployed and dev environments share one database?

## M. Appendix — Test matrix (this update)
| Area | LOCAL | DEPLOYED |
|---|---|---|
| Public UX | OK (all 200, fast) | OK (all 200, slower) |
| Registration | OK (email works) | Broken (no email delivery) |
| Buyer | OK | Partial (no stock, self-complete, wrong seller, no notifications) |
| Farmer | OK (full wallet loop) | Partial (no wallet/payout) |
| Admin | OK | OK |
| Order lifecycle | OK (stock→notify→commission→withdraw) | Broken |
| Security | OK (hardened) | Failing (role bypass, deleted-user access, self-complete) |
| Performance | Fast (ms) | Poor on email paths (30–63 s) |
| Notifications | Created but API 404 | None created + API 404 |
| Payments | Missing | Missing |

---

*Test accounts and artifacts from this audit remain in the shared production DB and should be cleaned up by an admin before launch (see B). Pre-existing legacy UAT users were preserved.*

---

# Part II — Business Rules, Financial Flow & Production Readiness (14 Aug 2026)

**Method:** black-box live testing against the LOCAL working tree (the deployable fixed version) + code review (local vs deployed `7428587`) + read-only DB reconciliation. Shared production DB means deployed/local views are the same data.

## 1. Product & Inventory

**Verdict: PASS on local working tree (this is the code you would deploy); the deployed commit has none of it (see Part I).**

| Test (local) | Result | Evidence |
|---|---|---|
| Create product | 201, `status=pending`, qty 3, price 2000 | API response |
| Visibility before approval | not listed | `/api/products` excludes it |
| Admin approve | 200, ~2.8 s | product becomes visible |
| Price integrity on order | server re-derives unit price from DB | client sent 1 RWF, order charged **500 RWF** |
| Order qty 0 | 400 "Invalid quantity… at least 1" | validation |
| Order qty 4 of stock 3 | 400 "Only 3 unit(s)… Requested: 4" | stock gate |
| Order qty == stock (3) | 201 | order placed, stock → 0 |
| Order after depletion | 400 "Only 0 unit(s)… Requested: 1" | stock gate |
| Order on unapproved product | 400 "not available for purchase" | status gate |
| Stock decrement | atomic `findOneAndUpdate` + rollback on partial failure | qty 3→0 after 3-unit order |

**Business bug (both envs):** cancelled and farmer-rejected orders **do not restore stock**. Verified: price-tamper order (qty 1) cancelled → stock stayed 0. Repeated cancellations permanently drain inventory; the `beans` product (no `quantity` field) can never be restocked. Buyer UI never shows stock anywhere (`item.html` has no quantity display; marketplace cards show none) — only a client-side "In Stock Only" filter exists.

## 2. Order & Financial Consistency (one controlled order)

Controlled order: qty 2 × 2000 RWF. **All surfaces agree:** total 4000, gross 4000, commission 80 (2%), farmerAmount 3920, platformAmount 80, lineTotal 4000 — identical in buyer `/api/orders`, farmer `/api/farmer/orders`, admin `/api/admin/orders`, checkout summary, and email template. Buyer/farmer analytics internally consistent (spent 11500 = revenue 11500).

**FAIL — admin dashboard does not reconcile with the actual wallet ledger** (observed live on BOTH local and deployed API, same DB):

| Figure | Dashboard (computed) | Wallet ledger (actual) |
|---|---|---|
| Platform commission | **440** (totalRevenue 22000 × 2%) | **230** (real commissionEarned) |
| Farmer earnings | **21,560** (computed) | **11,270** (real totalEarned) |

Reconciliation of the 210 gap: 4 legacy pre-wallet orders (Completed, `completedAt=null`, one has `commissionAmount:0`, one has no commission field at all) contribute 160, and order `ORD-1786697667776-umblzl` (Completed on the **deployed** env) contributes 50 — its commission was never processed because deployed code doesn't call `processOrderCommission`. Dashboard hard-codes `commissionRate = 0.02` instead of reading `PLATFORM_COMMISSION_PERCENT`. Result: the admin's "commission earned / farmer earnings" numbers are fiction that will not match payouts. This must be fixed before any real money or reporting.

Other consistency notes: completed orders keep `paymentStatus: "Pending"`, `paymentMethod: null`, `transactionId: null` — order history looks like money changed hands when none did. Legacy orders show `Unpaid`. `paymentStatus` values used in the UI are never set by any code path.

## 3. Payment Readiness — **BLOCKER**

**Classification: NOT IMPLEMENTED.**

- No payment provider code. `.env` has `DPO_MERCHANT_TOKEN` and `DPO_TEST_MODE`, but `PAYMENT_PROVIDER` and `DPO_SERVICE_TYPE` are **empty**, and there are zero DPO/MTN/MoMo integration functions in the codebase.
- All payment endpoints return 404: `/api/payment`, `/api/payments`, `/api/checkout/pay`, `/api/dpo/checkout`, `/api/payment/webhook`, `/api/webhook`.
- Checkout (`checkout.js`) has **no payment step** — it POSTs `/api/orders` straight to order creation.
- `paymentStatus` is written by **no code path**. It stays `Pending` from creation, through `Completed`, forever. No code sets `Paid/Failed/Refunded`.
- `models/Transaction.js` (the payment ledger) is **dead code** — 0 documents, no route uses it.
- **An order can be completed without any payment** (farmer marks an Accepted order Completed; nothing checks payment). No refund or chargeback flow exists.
- No sandbox/test-payment flow; no webhook; nothing happens "when payment fails" because payment never happens.

## 4. Wallet & Commission — **functional only on the fixed (local) build**

**Which event:** farmer sets an Accepted order to **Completed** → `processOrderCommission()` in `services/walletService.js` → credits farmer `farmerAmount` and platform `commissionAmount`, sets `commissionProcessed=true`, `payoutStatus=completed`, `completedAt`.

**Verified live:** farmer wallet +3920 / platform +80 exactly for the controlled order; no duplicate credit/commission transactions (idempotent: atomic `commissionProcessed` claim + per-order txn existence check; the route also blocks a second "complete"). Wallet balances persist in `wallets` / `platformwallets` / `wallettransactions` and the farmer UI (`/api/wallet`, fixed path) matches the DB.

**Problems:**
1. **Env-dependent processing:** only orders completed through the fixed local build credit the wallet. Completed-on-deployed orders never do → ledger vs dashboard gap (§2).
2. **`routes/wallet.js` uses `requireAuth`, not `requireFarmer`** — any logged-in user (buyer/admin) gets a wallet auto-created on first GET and can call withdraw endpoints (buyer withdraw fails on 0 balance, but the role check is absent). 5 wallets now exist, including buyers'.
3. **Withdraw request does not reserve funds** (`createWithdrawRequest` leaves `availableBalance` unchanged until approval). Two overlapping pending requests + two approving admins could both pass the balance check in a race.
4. **Pending vs available split is cosmetic** — `creditWallet` then immediate `releasePendingFunds`; farmer earnings are available instantly, contradicting the "pending payment" model the field names imply.

## 5. Order Status Rules (local) — PASS with one business gap

| From | To | Who | Verified |
|---|---|---|---|
| Pending | Cancelled | Buyer (own order) | ✓ 200 |
| Pending | Accepted / Rejected | Farmer (must own a product in the order) | ✓ 200 / 403 if unrelated |
| Accepted | Completed | Farmer | ✓ 200 |
| any other transition | — | blocked 400 ("Only pending orders can be accepted", "Only accepted orders can be completed", etc.) | ✓ |
| Completed → anything | — | blocked 400 | ✓ (completed orders are immutable via API) |

Verified live: complete-from-Pending 400; re-accept 400; backwards (set Pending) 400; buyer-cancel-accepted 400; buyer attempt `Paid`/farmer attempt `Shipped` 400 (not in allowed sets). **Business gap:** farmer can complete an order that was never paid (§3) and rejection/cancellation never restocks (§1).

## 6. Notifications & Email

- **In-app notifications are independent of email on the fixed build:** `Notification.create` runs before/independent of `sendMail`, each in its own try/catch. Verified: buyer received 6 (`order_accepted`+`order_completed` ×3), farmer 5 (`new_order`), regardless of email.
- **BUT the read API does not exist:** `/api/notifications` and `/api/notifications/unread-count` → 404 on both envs (router never mounted in `server.js`). The notification bell silently falls back to an empty `localStorage` list. Feature is effectively dead in the UI.
- On **deployed**, notifications are never created (coupled to the failing email block in the committed code).
- Email = Nodemailer SMTP to `smtp-relay.brevo.com`, 30 s timeouts, inline in request handlers. Works only from the dev machine (~4–8 s); on Render it blocks 30–63 s and never delivers (registration/forgot/order/approve/contact all affected).

## 7. Data Integrity (Buyer → Order → Product → Farmer)

- Correct farmer receives the order (farmer sees only orders containing their products; unrelated farmer PATCH → 403; `farmerName` on items correct). Correct buyer owns the order (buyer list is filtered by `req.user`). Product reference correct; item snapshot (name/price/lineTotal) at order time is intentional price protection, not stale data.
- Deleted/suspended users blocked from privileged ops on the fixed build (401/403). Admin user/role/suspend endpoints correctly prevent self-mutation.
- **Weakness:** admin "delete user" does not cascade — orders keep dangling `buyer`/`owner` references; orders/wallets/withdrawals survive the user's deletion. `beans` product missing `quantity` field under-counts `outOfStockProducts` (dashboard reports 0 for an effectively zero-stock product).
- Shared production DB between local dev and Render (different JWT secrets) means running the dev server mutates production data.

## 8. Production Readiness

| Area | Status | Evidence |
|---|---|---|
| Env vars/secrets | PASS (configured) | MONGO_URI, JWT_SECRET, email creds, Cloudinary, DPO token set; `PAYMENT_PROVIDER`, `DPO_SERVICE_TYPE` empty; passwords/codes excluded from user responses |
| **CORS** | **FAIL** | Allowlist is dead code — preflight from `https://evil.example.com` returned 204 with `Access-Control-Allow-Origin: https://evil.example.com` and `credentials:true` (both envs). Bearer-token auth limits impact, but the intended allowlist is not enforced |
| CSP/security headers | PASS (minor) | helmet CSP, HSTS, nosniff, `frame-ancestors 'none'`; contradiction: `X-Frame-Options: SAMEORIGIN`; `connectSrc 'self'` fine for same-origin app |
| Authentication | PASS | JWT; deleted→401, suspended→403, unverified-login→403, expiry handled |
| Authorization | PASS (local) / FAIL (deployed) | local: role checks on farmer/admin; deployed: buyer→farmer routes 200 (Part I §G) |
| Rate limiting | PASS | 200/15min global on `/api` (headers verified: 200, remaining ~147/197), 10/15min login, 5/h register, 5/15min reset, 10/h contact — 429 behaviour verified earlier |
| Error handling | PASS | centralized handlers; generic 400/404/500; prod masks messages; no stack traces; multer file limits enforced |
| Logging | ADEQUATE | morgan combined + console.error; no structured logging or retention |
| DB connection/recovery | PASS | connect-with-retry (5), readiness guard → 503, disconnect/reconnect handlers, `bufferCommands:false`, pool 10 |
| HTTPS/Render | PASS (perf caveat) | HSTS; cold start on Render measured **23.2 s** for `/health` |
| Custom domain | PASS | app binds 0.0.0.0, serves static+API same origin |
| Email | **FAIL (deployed)** | never delivers; 30–63 s blocks |
| Payment | **BLOCKER** | §3 |
| Data/privacy (DPO phase) | **FAIL** | no consent/privacy notices, no DPO/record-keeping structures, admin can't see audit of password changes, orphaned refs on user delete |

---

## N. Production Readiness Gate

**GATE — next deployment phase (deploy the fixed working tree to Render): YELLOW.**
**GATE — money-handling production launch: RED** (no payments; email broken on Render).

### Must fix before production (all YELLOW/RED gate items)

| # | Item | Observed | Evidence | Why it matters | Priority |
|---|---|---|---|---|---|
| P1 | Payment integration (DPO/MoMo) | No provider, no payment step, `paymentStatus` never set, 0 payment routes, Transaction model unused | §3; `/api/dpo/*` 404; ledger docs=0 | Marketplace cannot take payment; orders complete "unpaid" | CRITICAL |
| P2 | Email on Render | Signup/order/approve/contact block 30–63 s, never deliver | §6, Part I-C | New users cannot verify; no transactional email | CRITICAL |
| P3 | Ledger vs dashboard reconciliation | Dashboard 440 commission / 21,560 earnings vs ledger 230 / 11,270 | §2 live numbers | Payouts and reports would be wrong; legal/financial risk | HIGH |
| P4 | Mount notification API | `/api/notifications` 404 both envs; UI shows empty localStorage fallback | §6, Part I-H | In-app notifications feature is non-functional despite DB data | HIGH |
| P5 | Restock on cancel/reject | Cancelled/rejected orders never restore quantity (verified qty stayed 0) | §1, §5 | Inventory silently shrinks; oversell of phantom stock over time | HIGH |
| P6 | Enforce CORS allowlist | Any origin echoed with `credentials:true` | §8 | Intended security control is dead code; token theft from any page becomes trivial if a token is leaked | MEDIUM |
| P7 | Role-gate wallet routes | `/api/wallet` requires only `requireAuth`; buyer gets auto-created wallet | §4 | Non-farmers can call wallet/withdraw endpoints; polluted wallets | MEDIUM |
| P8 | Fix dashboard commission source + count only orders that actually processed | Hardcoded 0.02 + counts legacy/Accepted orders | §2 | Feeds P3 | HIGH (with P3) |
| P9 | Ship Part I local fixes to Render | Deployed has role bypass, no stock, no wallet, no notifications, buyer self-complete, deleted-user access | Part I-G/H | These are security holes on the live site | CRITICAL (deploy) |
| P10 | Isolate dev DB from production Mongo | Local dev writes to prod DB; different JWT secrets | §7 | Test data pollutes prod; cross-env confusion | MEDIUM |

### Can be improved after launch

- Withdraw fund-reservation / admin-approval race hardening (§4).
- Pending-vs-available wallet semantics decision (auto-release vs hold) (§4).
- User deletion cascade / referential cleanup (§7).
- Stock display on product detail + marketplace cards (§1).
- `X-Frame-Options: SAMEORIGIN` vs `frame-ancestors 'none'` cleanup (§8).
- Structured logging + retention (§8).
- Rwanda-only copy/currency i18n (Part I-M5).
- Admin dashboard `outOfStockProducts` counting (missing `quantity` field) (§7, Part I-M3).

### Summary matrix (Part II)
| Area | Local (fixed) | Deployed |
|---|---|---|
| Product lifecycle + inventory | PASS | FAIL (no checks/decrement) |
| Order financial math | PASS (internally consistent) | FAIL (contradicts ledger) |
| Payment | BLOCKER (not implemented) | BLOCKER |
| Wallet/commission | PASS (local route only) | FAIL (dead code) |
| Order status rules | PASS (with unpaid-complete gap) | FAIL (buyer self-complete) |
| Notifications | PARTIAL (created, API missing) | FAIL (never created) |
| Data integrity | PASS | FAIL (deleted-user leak) |
| Security hardening | PASS (CORS aside) | FAIL |

*Nothing was modified in application code during this audit stage. All figures above were captured live from the API and the shared database on 14 Aug 2026.*

---

# Part III — UAT Cleanup & Production Baseline (14 Aug 2026)

**Scope:** remove only records created for testing from the shared production DB; preserve all genuine data; no application code changed.

## Inventory & deletion (52 UAT records removed)

| Collection | Deleted | Identifiers | Why UAT |
|---|---|---|---|
| users | 8 | `agcaudit*-*@emalupe.com` (buyer ×2, farmer ×2, resend-test, temp admin) + `agc-uat-buyer-001/002@maildrop.cc` | audit-created accounts; legacy baseline UAT accounts (unverified, expired codes) |
| products | 10 | `UAT *` ×9 + `Buyer Sneak deployed` | audit products (pending/approved/rejected), incl. role-bypass evidence |
| orders | 7 | `ORD-1786697000120-1wkzw9`, `-7116583-56d55e`, `-7667776-umblzl`, `-7909972-r1th22`, `-9301414-oftrw3`, `-9315810-98zibb`, `-9335779-9iq8pp` | all orders owned by UAT buyers (cross-checked: 0 extra) |
| notifications | 11 | for UAT buyer (6) + UAT farmer (5) | order-event test notifications |
| wallets | 3 | UAT farmer ×2 + UAT buyer ×1 (auto-created) | wallet/commission test wallets |
| wallettransactions | 8 | 3 credit + 3 commission + 2 withdrawal | all reference UAT orders/farmer |
| withdrawrequests | 1 | local UAT farmer 2000 RWF (approved) | test withdrawal |
| platformwallets | 1 | the only doc (230 RWF) | 100% of balance from UAT orders |
| contactmessages | 3 | 2 `UAT Tester` + 1 `Email Test noexist-contact-xyz@example.com` | audit contact-form tests |
| **Total** | **52** | | |

Deletion order respected dependencies (children first: tx/withdrawals → wallets → orders → products → users). Safety assertions passed: orders owned by UAT users = 7 (0 extra), products owned by UAT farmers = 9 (0 extra).

## Post-cleanup state (genuine data preserved)
- users **6** (admin, 3 farmers, 2 buyers) — no audit account remains
- products **1** (`beans`, approved, qty 0, genuine owner)
- orders **4** (legacy July records, buyers `placidesenadata75` id `6a5fb9b5…`)
- notifications **4**, wallets **2** (genuine farmers), wallettransactions **0**, withdrawrequests **0**, platformwallets **0**
- contactmessages **26**, auditlogs **21** (append-only trail preserved intact)

## Kept despite uncertainty (flagged, not deleted)
1. Wallets for genuine farmers `agriconnect.helpdesk` & `senadataplacide` (0 balance, 0 tx) — wallet-route testing may have auto-created them, but they belong to genuine users; removed would be re-created on first wallet access anyway.
2. `senadataplacide8@gmail.com` remains `suspended=true` — genuine account; suspension state not proven to be audit-created, left as-is.
3. Legacy orders `ORD-1785100278897-f774qr` / `ORD-1785101960382-82ds2d` remain `Completed` with `completedAt=null`, no commission — genuine-era records; the dashboard misreport they cause is a code fix (P3/P8), not a data deletion.
4. All 21 audit logs preserved (they document historical admin actions).

## Post-cleanup verification
- LOCAL: `/health` 200, `/` 200, `/api/products` → exactly the genuine `beans`; login of a deleted UAT account → 401; unknown login → 401; `/api/auth/me` no token → 401.
- DEPLOYED (same DB): `/health` 200, `/api/products` → same `beans`.
- Application starts, connects to MongoDB, public pages and auth work normally on both environments.

*Database baseline is now clean: only genuine users, catalog, orders, notifications, contact messages, wallets, and audit logs remain.*
