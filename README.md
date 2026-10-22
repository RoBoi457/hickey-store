# Hickey storefront

A responsive storefront with a 13-design keychain collection, interactive FAQ, persistent basket, product previews, contact forms, and a Cloudflare Pages checkout using fixed-amount Razorpay UPI QR codes. Current catalog prices are placeholders: ₹299 per single charm and ₹499 for the matching pair.

## Preview

Open `index.html` locally to explore the storefront. Checkout requires the deployed Pages Functions, Razorpay account configuration, and D1 database; it does not work from a `file://` preview.

## Cloudflare Pages setup

The repository is connected to Cloudflare Pages on `main`; with automatic deployments enabled, a push to `main` publishes the website and its Pages Functions. The current static site uses no build step: leave the build command blank and set the output directory to `.`.

### Connect order storage

1. In Cloudflare, open **Workers & Pages → D1 SQL Database** and create a database.
2. Open the Pages project → **Settings → Functions → D1 database bindings**. Add a binding named exactly `DB` and select the database. Add a binding for Production, and for Preview too if you want checkout working in branch previews. Save and redeploy.
3. In the D1 database **Console**, apply `migrations/0001_create_orders.sql`, then `migrations/0002_add_customer_name.sql`. Run each file's SQL once against the same database. If migration 1 is already applied, apply only migration 2.

### Connect Razorpay safely

1. Create or activate your Razorpay merchant account and generate **Test Mode** API keys.
2. In Pages project → **Settings → Variables and Secrets**, add `RAZORPAY_KEY_ID` and encrypted secret `RAZORPAY_KEY_SECRET` to Preview (and Production when ready). Never put the secret in site files, GitHub, screenshots, or chat.
3. Ask Razorpay Support or your account contact to enable its on-demand **UPI QR Codes API**. Standard checkout activation may not include this API.
4. Save the variables and redeploy. Open your Pages `pages.dev` address, add a product, and complete a test checkout. Confirm that the site shows success, an order appears in the order desk, and the payment appears in Razorpay's Test Mode dashboard.

### Open the private order desk

1. Make a long random admin token on your Mac (Terminal): `openssl rand -hex 32`.
2. In Cloudflare Pages → **Settings → Variables and Secrets**, add `ADMIN_TOKEN` as an encrypted secret for Production. Add it to Preview only if you need the order desk there. Do not put this token in the repository.
3. Redeploy, then open `https://YOUR-PAGES-DOMAIN/admin.html`. Enter the token. It stays in the current browser tab session; use **Lock desk** on shared devices.
4. Review the 14-day revenue chart, paid/pending totals, order details and payment references. Search or filter by status/date, then choose **Download CSV** to open the records in Numbers, Excel, or Google Sheets.

The dashboard at `/admin.html` calls a server-side Pages Function protected by `ADMIN_TOKEN`. It reads only from D1, uses parameterized database queries, and returns private no-cache responses. The CSV is intended for your bookkeeping; store it securely because it contains customer names, phone numbers, and delivery addresses. Keep Cloudflare and Razorpay account access limited and protected with 2FA.

## How checkout works

The server validates the customer's name, phone and address; recalculates prices from its own product catalog; creates a single-use UPI QR fixed to the order total; and saves the order as pending in D1. The checkout asks Razorpay's API for that QR's payment records and changes the order to paid only after it finds a captured UPI payment for the exact amount. The QR expires after 20 minutes. The Razorpay secret is used only by the server-side Pages Functions.

The current payment confirmation flow checks while the checkout page is open. For a live launch, configure a Razorpay payment webhook with signature validation and test it, so payment records can be synchronized even when a customer closes checkout. Do not ship an order based only on a screenshot or customer claim; verify its captured status in Razorpay. You can see the authoritative payment and settlement details in Razorpay Dashboard → **Transactions → Payments**. Match the Payment ID there with the order desk.

## Where data lives

- **Orders and shipping details:** Hickey's D1 database, visible in `/admin.html` and the Cloudflare D1 console. The dashboard can export filtered orders to CSV.
- **Payment, refund and settlement records:** Razorpay Dashboard → **Transactions → Payments**. Match by Razorpay Payment ID.
- **Ideas, feedback, and custom design requests:** the contact forms open the visitor's email app and only send after the visitor presses Send; they do not save to D1. Replace `hello@hickey.store` in `script.js` and the contact link with an inbox you control before launch.

## Move from test to live

After the test flow works and Razorpay activates the account and QR API, add your **Live Mode** `RAZORPAY_KEY_ID` and encrypted `RAZORPAY_KEY_SECRET` to the Production environment, then redeploy and make a small real payment. Keep Test and Live keys in their matching Razorpay modes. Use a Production D1 binding for real orders. Do not enable real sales until the live payment, order record, and fulfillment process are confirmed.

## References

- [Cloudflare Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare D1 getting started](https://developers.cloudflare.com/d1/get-started/)
- Razorpay [Create a QR Code API](https://razorpay.com/docs/api/qr-codes/create/) and [Fetch Payments for a QR Code API](https://razorpay.com/docs/api/qr-codes/gst/fetch-payments/)
- [Razorpay payment dashboard](https://razorpay.com/docs/payments/payments/dashboard/)
- [Razorpay security checklist](https://razorpay.com/security/checklist/)
