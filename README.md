# Hickey storefront replica

A responsive, static-first recreation of the Hickey Base44 preview from the supplied 36-second screen recording. It includes the landing page, a 13-item keychain collection with generated product mockups, an interactive FAQ section, a staged hero entrance with animated fireflies, a stronger color wash, reversible cloud-dispel transitions and tile snap effects, a marquee that moves with scroll position only while in view, a persistent basket, quantity controls, and a custom order-summary checkout with Razorpay-powered fixed-amount UPI QR payment. The contact section has suggestion, feedback/question, and exclusive small-run design request forms. Desktop content stays at 90% scale while the hero returns to its original size; mobile remains at its normal scale. Catalog prices are currently editable placeholders: ₹299 per single charm and ₹499 for the matching pair.

## Run it locally

Open `index.html` in a browser to preview the layout and basket. The hosted order flows need the serverless routes and D1 database because a browser-only page must never hold the Razorpay secret key or claim an order was saved when it was not.

## Cloudflare Pages setup

Cloudflare Pages is the easiest free fit for this version: it can serve the static files, run the included Pages Functions, and bind a D1 database. The default `pages.dev` address is free. Custom domain registration is a separate purchase.

1. Create a Git repository with these files and connect it to a new Cloudflare Pages project. Set the project root to `outputs/hickey-store` if you keep this workspace layout; if you copy the folder contents to a separate repository, use that repository root. Leave the build command blank and set the output directory to `.`.
2. Create a D1 database in the Cloudflare dashboard. Bind it to the Pages project using the binding name `DB`.
3. Apply `migrations/0001_create_orders.sql` and then `migrations/0002_add_customer_name.sql` to that D1 database from the database console or with Wrangler.
4. Add the Razorpay key variables below to the Pages project environment. Use test keys in Preview first.

## Razorpay UPI setup

The repository includes Cloudflare Pages Functions at `functions/api/create-order.js`, `functions/api/verify-qr.js`, and `functions/api/cancel-qr.js`.

1. Deploy this folder as a Cloudflare Pages project. Connect a Git repository (or upload the files); use a blank build command and `.` as the output directory.
2. In Cloudflare, create a D1 database. Open the Pages project settings, add a D1 binding named `DB`, and apply `migrations/0001_create_orders.sql` followed by `migrations/0002_add_customer_name.sql` to the database. If you already applied the first migration, apply only the second one now.
3. Create a Razorpay account and generate **Test Mode** API keys. In Pages Settings → Variables and Secrets, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to the Preview environment. Store the secret as an encrypted secret; never put it in `index.html`, `script.js`, or a public repository.
4. Ask Razorpay Support to enable its on-demand **UPI QR Codes API** feature for your merchant account. Standard checkout activation alone may not enable QR-code creation.
5. Redeploy the Pages project so the Functions receive the D1 binding and test keys. Open its `pages.dev` URL (the payment API does not work from a `file://` preview), add products, and test checkout with Razorpay's test setup.
6. After Razorpay finishes merchant verification and enables UPI QR Codes, add the **Live Mode** key ID and encrypted secret to the Production environment, then redeploy and make a small live payment to verify the complete flow.

At checkout, the server recalculates the basket total from its own catalogue, creates a single-use Razorpay UPI QR locked to that exact amount, saves the order as pending, and returns the QR image URL. The checkout checks Razorpay's QR payment records on the server and marks an order paid only after it finds a captured UPI payment for the exact order amount. The QR expires after 20 minutes. The Razorpay secret stays in Cloudflare's server environment and is never sent to the browser. QR Codes API availability is account-gated; request activation from Razorpay before using this payment option. For a live store, add a Razorpay webhook with signature validation and connect fulfilment notifications before shipping goods. D1 stores each order's customer name, phone, delivery address, product list, amount, payment status, and Razorpay payment ID. Restrict access to the Cloudflare account and delete records according to your retention policy.

## Where order and payment information appears

- **Customer/order details:** Cloudflare Dashboard → **Workers & Pages → D1 SQL Database** → select the database → **Console**. Run `SELECT order_ref, customer_name, phone, delivery_address, items_json, amount_rupees, status, razorpay_payment_id, created_at FROM orders ORDER BY created_at DESC;`. The D1 console also has a Tables view for browsing rows. [Cloudflare's D1 guide](https://developers.cloudflare.com/d1/get-started/) documents the Console and Tables views.
- **Payment details and settlements:** Razorpay Dashboard → **Transactions → Payments** → open a Payment ID. The payment view includes payment and settlement details. Match its Payment ID with `razorpay_payment_id` in the Hickey D1 order row. [Razorpay's dashboard guide](https://razorpay.com/docs/payments/payments/dashboard/) shows this path.
- **Contact form messages:** the idea, feedback, and custom design forms open the visitor's email app with a message addressed to `hello@hickey.store`. Those notes are delivered to that inbox only after the visitor presses Send. Replace that address in `script.js` and the contact link in the page with an inbox you control before launch; these forms do not write to D1.

## Free hosting choices

### Cloudflare Pages — best fit for this build

Connect a Git repository or upload the site files as a Pages project. Static files are served on the free plan, Pages Functions can host the small order/payment API, and D1 can store orders. The Cloudflare Workers Free plan currently includes 100,000 requests per day; D1 also has a free allowance. See [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). A custom domain name is optional and usually costs money; the provided `pages.dev` address is free.

### Netlify — simple static deployment

Netlify’s Free plan currently costs $0 and includes 300 monthly credits, deploy previews, and functions. The site can be hosted there, but the included Razorpay endpoints are Cloudflare Pages Functions and would need conversion to Netlify Functions. Netlify pauses projects when the free monthly credit limit is reached. See [Netlify pricing](https://www.netlify.com/pricing/).

### Vercel Hobby — fine for a personal demo

Vercel’s free Hobby plan is limited to personal, non-commercial use. Because this storefront is designed to sell products, use Cloudflare Pages or another host whose terms fit a commercial storefront instead. See [Vercel Hobby plan](https://vercel.com/docs/plans/hobby).

GitHub Pages is useful for a public static learning demo, but GitHub explicitly disallows using its free Pages hosting to run an e-commerce site. Do not use it for the live Hickey store. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Payment reference

The UPI QR flow follows Razorpay's official [Create a QR Code API](https://razorpay.com/docs/api/qr-codes/create/) and [Fetch Payments for a QR Code API](https://razorpay.com/docs/api/qr-codes/gst/fetch-payments/). Razorpay says its UPI QR code API is an on-demand feature and must be activated for the merchant account.

## Image and source notes

The supplied recording did not include a Base44 export or product image files. The provided Hickey logo image is saved at `assets/hickey-logo.png` and used in the hero and footer. The layout, visible product copy, colors, and interaction patterns are recreated from the video; several product and team photos remain close visual substitutes from Unsplash. Replace those photo URLs with the original Base44 assets for a pixel-accurate match. Team member details not legible in the recording remain placeholders.
