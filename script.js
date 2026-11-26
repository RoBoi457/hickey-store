const PRODUCTS = {
  "kathor-clock": { name: "The Rohtak Clock", price: 69, category: "keychain", image: "assets/keychain-products-opt/01-rohtak-standard-time.jpg" },
  pda: { name: "PDA Tree", price: 69, category: "keychain", image: "assets/keychain-products-opt/02-pda-campus.jpg" },
  "submit-mode": { name: "Spiderman", price: 69, category: "keychain", image: "assets/keychain-products-opt/03-atp-submit.jpg" },
  "clock-it": { name: "Clock It", price: 69, category: "keychain", image: "assets/keychain-products-opt/04-clock-it.jpg" },
  "coke-paglu": { name: "Diet Coke Paglu", price: 69, category: "keychain", image: "assets/keychain-products-opt/05-diet-coke-paglu.jpg" },
  cooks: { name: "Cooked", price: 69, category: "keychain", image: "assets/keychain-products-opt/06-cooks.jpg" },
  "proxy-pass": { name: "Claudey Proxy Mat Laga", price: 69, category: "keychain", image: "assets/keychain-products-opt/07-proxy-mat-laga.jpg" },
  baddie: { name: "The Baddie Club", price: 69, category: "keychain", image: "assets/keychain-products-opt/08-baddie.jpg" },
  "kathor-land": { name: "Kathor Land", price: 69, category: "keychain", image: "assets/keychain-products-opt/09-kathor-land.jpg" },
  nonchalant: { name: "Non Chalant", price: 69, category: "keychain", image: "assets/keychain-products-opt/11-nonchalant.jpg" },
  "two-friends": { name: "Couple Design", price: 99, category: "keychain", image: "assets/keychain-products-opt/12-two-friends.jpg" },
  "campus-cat-nap": { name: "CAT Whore", price: 69, category: "keychain", image: "assets/keychain-products-opt/13-cat-whore-campus-nap.jpg" },
  "clinger-cat-club": { name: "Gingerrrrr", price: 69, category: "keychain", image: "assets/keychain-products-opt/14-clinger-cat-club.jpg" },
  "same-old-day": { name: "CAT checklist", price: 69, category: "keychain", image: "assets/keychain-products-opt/15-same-old-day.jpg" }
};

if (window.HickeyStickers && Array.isArray(window.HickeyStickers.items)) {
  for (const sticker of window.HickeyStickers.items) {
    PRODUCTS[sticker.id] = sticker;
  }
}

document.documentElement.classList.add("motion-ready");

const STORAGE_KEY = "hickey-basket-v1";
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const nav = document.getElementById("float-nav");
const drawer = document.getElementById("basket-drawer");
const scrim = document.getElementById("scrim");
const checkoutLayer = document.getElementById("checkout-layer");
const productPreviewLayer = document.getElementById("product-preview-layer");
const contactLayer = document.getElementById("contact-layer");
const checkoutForm = document.getElementById("checkout-form");
const contactForm = document.getElementById("contact-form");
const toast = document.getElementById("toast");
let basket = readBasket();
let toastTimer;
let lastScrollY = window.scrollY;
let previewProductId = null;
let previewReturnFocus = null;
let contactType = "suggestion";
let contactReturnFocus = null;

const contactCopy = {
  suggestion: {
    eyebrow: "A LITTLE IDEA, BIG LORE",
    title: 'Pitch us a <em>new inside joke.</em>',
    intro: "What should we make next? Give us the punchline, the reference, or just the chaotic first thought.",
    placeholder: "Type your idea here…",
    subject: "A new Hickey idea"
  },
  feedback: {
    eyebrow: "WE’RE ALL EARS",
    title: 'Question, feedback, <em>tiny rant?</em>',
    intro: "Tell us what’s working, what needs a tweak, or what you’re wondering about. We read every note.",
    placeholder: "Write your feedback or question…",
    subject: "Hickey feedback or question"
  },
  custom: {
    eyebrow: "SMALL RUN · BIG MAIN-CHARACTER ENERGY",
    title: 'Dream up your <em>own design.</em>',
    intro: "This is for a highly customized exclusive design made in a smaller production run. Tell us the story, the look, and roughly how many you have in mind.",
    placeholder: "Describe your custom design…",
    subject: "Hickey exclusive small-run design request"
  }
};

function openContact(type, trigger) {
  contactType = contactCopy[type] ? type : "suggestion";
  contactReturnFocus = trigger || document.activeElement;
  const copy = contactCopy[contactType];
  document.getElementById("contact-eyebrow").textContent = copy.eyebrow;
  document.getElementById("contact-title").innerHTML = copy.title;
  document.getElementById("contact-intro").textContent = copy.intro;
  document.getElementById("contact-message").placeholder = copy.placeholder;
  const extras = document.getElementById("contact-extra");
  extras.hidden = contactType === "suggestion";
  document.getElementById("contact-quantity-label").hidden = contactType !== "custom";
  document.getElementById("contact-quantity").hidden = contactType !== "custom";
  document.getElementById("contact-note").textContent = "Your message will be sent directly to our team.";
  contactForm.reset();
  contactLayer.classList.add("is-open");
  contactLayer.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => document.getElementById("contact-message").focus(), 100);
}

function closeContact() {
  contactLayer.classList.remove("is-open");
  contactLayer.setAttribute("aria-hidden", "true");
  if (!checkoutLayer.classList.contains("is-open") && !drawer.classList.contains("is-open")) document.body.classList.remove("modal-open");
  if (contactReturnFocus && typeof contactReturnFocus.focus === "function") contactReturnFocus.focus();
}

function readBasket() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([id, qty]) => PRODUCTS[id] && Number.isInteger(qty) && qty > 0));
  } catch (_) {
    return {};
  }
}

function saveBasket() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(basket)); } catch (_) {}
  window.HickeyAuth?.persistCart(basket);
  renderBasket();
  if (productPreviewLayer.classList.contains("is-open")) renderPreviewQuantity();
}

function basketCount() {
  return Object.values(basket).reduce((sum, count) => sum + count, 0);
}

function basketTotal() {
  return Object.entries(basket).reduce((sum, [id, count]) => sum + PRODUCTS[id].price * count, 0);
}

function renderBasket() {
  const items = document.getElementById("basket-items");
  const empty = document.getElementById("basket-empty");
  const bottom = document.getElementById("drawer-bottom");
  const count = basketCount();
  const badge = document.getElementById("bag-count");
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = count === 0;
  document.getElementById("basket-total").textContent = rupees.format(basketTotal());
  renderProductControls();
  const isEmpty = count === 0;
  empty.classList.toggle("is-empty", isEmpty);
  bottom.classList.toggle("is-hidden", isEmpty);
  items.innerHTML = Object.entries(basket).map(([id, qty]) => {
    const product = PRODUCTS[id];
    return '<article class="basket-row" data-row="' + id + '">' +
      '<div class="basket-thumb"><img src="' + product.image + '" alt="" loading="lazy"></div>' +
      '<div class="basket-line"><h3>' + product.name + '</h3><strong>' + rupees.format(product.price) + '</strong>' +
      '<div class="quantity-controls"><button type="button" data-quantity="' + id + '" data-change="-1" aria-label="Remove one ' + product.name + '">−</button><span>' + qty + '</span><button type="button" data-quantity="' + id + '" data-change="1" aria-label="Add one ' + product.name + '">+</button></div></div>' +
      '<button type="button" class="remove-item" data-remove="' + id + '" aria-label="Remove ' + product.name + ' from basket"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5"/></svg></button></article>';
  }).join("");
  updateCheckoutSummary();
}

function renderProductControls() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const id = card.dataset.productId;
    const photo = card.querySelector(".product-photo");
    if (!id || !photo) return;
    let control = photo.querySelector(".product-quantity");
    if (!control) {
      control = document.createElement("div");
      control.className = "product-quantity";
      control.innerHTML = '<button type="button" data-product-action="decrease" aria-label="Remove one">−</button><span data-product-count aria-live="polite">1</span><button type="button" data-product-action="increase" aria-label="Add one">+</button>';
      photo.append(control);
    }
    const quantity = basket[id] || 0;
    const productName = PRODUCTS[id]?.name || "product";
    const addButton = photo.querySelector("[data-add]");
    if (addButton) addButton.hidden = quantity > 0;
    control.hidden = quantity === 0;
    control.querySelector("[data-product-count]").textContent = String(quantity);
    control.querySelector('[data-product-action="decrease"]').setAttribute("aria-label", "Remove one " + productName);
    control.querySelector('[data-product-action="increase"]').setAttribute("aria-label", "Add one " + productName);
  });
}

function updateCheckoutSummary() {
  const total = basketTotal();
  const count = basketCount();
  document.getElementById("checkout-total").textContent = rupees.format(total);
  document.getElementById("checkout-item-summary").textContent = count + " item(s)";
  document.getElementById("submit-order").textContent = "Continue to secure payment";
  document.getElementById("basket-total").textContent = rupees.format(total);
  document.getElementById("checkout-sidebar-total").textContent = rupees.format(total);
  renderCheckoutCart();
  document.querySelector(".basket-total span").textContent = "Total";
  document.getElementById("start-checkout").textContent = "Continue to checkout";
}

function renderCheckoutCart() {
  const target = document.getElementById("checkout-summary-items");
  if (!target) return;
  target.innerHTML = Object.entries(basket).map(([id, quantity]) => {
    const product = PRODUCTS[id];
    return '<div class="checkout-summary-item"><img src="' + product.image + '" alt=""><div><strong>' + product.name + '</strong><span>Qty ' + quantity + '</span></div><b>' + rupees.format(product.price * quantity) + '</b></div>';
  }).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function openDrawer() {
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  scrim.classList.add("is-visible");
  document.body.classList.add("modal-open");
  document.getElementById("close-bag").focus();
}

function closeDrawer() {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  if (!checkoutLayer.classList.contains("is-open")) {
    scrim.classList.remove("is-visible");
    document.body.classList.remove("modal-open");
  }
}

function openCheckout() {
  if (basketCount() === 0) return;
  if (!window.HickeyAuth?.user) {
    closeDrawer();
    window.HickeyAuth?.request({ type: "checkout" });
    return;
  }
  closeDrawer();
  updateCheckoutSummary();
  document.getElementById("checkout-layout").hidden = false;
  document.getElementById("checkout-content").hidden = false;
  checkoutForm.hidden = false;
  document.getElementById("order-success").hidden = true;
  document.getElementById("payment-message").textContent = "";
  document.getElementById("checkout-title").innerHTML = 'Your Hickey is <em>almost home.</em>';
  document.getElementById("checkout-intro").textContent = "Where should we send your inside joke?";
  checkoutLayer.classList.add("is-open");
  checkoutLayer.setAttribute("aria-hidden", "false");
  scrim.classList.add("is-visible");
  document.body.classList.add("modal-open");
  setTimeout(() => document.querySelector('input[name="address"]').focus(), 120);
}

function closeCheckout() {
  checkoutLayer.classList.remove("is-open");
  checkoutLayer.setAttribute("aria-hidden", "true");
  scrim.classList.remove("is-visible");
  document.body.classList.remove("modal-open");
}

function showSuccess(orderNumber) {
  document.getElementById("checkout-layout").hidden = true;
  document.getElementById("order-success").hidden = false;
  document.getElementById("success-message").textContent = "Payment confirmed for order " + orderNumber + ". We’ll be in touch when your Hickey is getting ready to ship.";
  basket = {};
  saveBasket();
}

function addToBasket(id) {
  if (!PRODUCTS[id]) return;
  if (!window.HickeyAuth?.user) {
    window.HickeyAuth?.request({ type: "add", id });
    return;
  }
  basket[id] = Math.min(99, (basket[id] || 0) + 1);
  saveBasket();
  const button = document.querySelector('[data-add="' + id + '"]');
  if (button) {
    button.classList.add("added");
    setTimeout(() => button.classList.remove("added"), 550);
  }
  showToast(PRODUCTS[id].name + " added to your basket.");
}

function changeQuantity(id, difference) {
  if (!basket[id]) return;
  const next = basket[id] + difference;
  if (next <= 0) delete basket[id];
  else basket[id] = Math.min(99, next);
  saveBasket();
}

function openProductPreview(card) {
  const id = card.dataset.productId;
  const product = PRODUCTS[id];
  if (!product) return;
  previewProductId = id;
  previewReturnFocus = card;
  const isSticker = product.category === "sticker";
  const image = card.querySelector(".product-photo img");
  document.getElementById("preview-image").src = product.image;
  document.getElementById("preview-image").alt = image?.alt || product.name;
  const eyebrowEl = document.getElementById("preview-eyebrow");
  if (eyebrowEl) eyebrowEl.textContent = isSticker ? ("DIE-CUT VINYL · " + (product.pack || "STICKER").toUpperCase()) : "A LITTLE CAMPUS LEGEND";
  document.getElementById("preview-title").textContent = isSticker ? (product.title || product.name) : product.name;
  document.getElementById("preview-description").textContent = product.description || card.querySelector(".product-info p")?.textContent || "";
  const sizeEl = document.getElementById("preview-spec-size");
  const matEl = document.getElementById("preview-spec-material");
  const noteEl = document.getElementById("preview-note");
  if (sizeEl) sizeEl.textContent = isSticker ? "3 × 3 in (Die-Cut)" : "2.25cm radius";
  if (matEl) matEl.textContent = isSticker ? (product.badge === "Holo" ? "Holographic Vinyl" : "Waterproof Matte Vinyl") : "Acrylic";
  if (noteEl) noteEl.textContent = isSticker ? "Peel-and-stick waterproof vinyl for laptops, bottles, notebooks, and dorm doors." : "A small keepsake for your keys, bag, or favourite person.";
  document.getElementById("preview-price").textContent = rupees.format(product.price);
  renderPreviewQuantity();
  productPreviewLayer.classList.add("is-open");
  productPreviewLayer.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.getElementById("close-product-preview").focus();
}

function renderPreviewQuantity() {
  if (!previewProductId) return;
  const quantity = basket[previewProductId] || 0;
  const product = PRODUCTS[previewProductId];
  const addButton = document.getElementById("preview-add");
  const quantityControl = document.getElementById("preview-quantity");
  addButton.hidden = quantity > 0;
  quantityControl.hidden = quantity === 0;
  document.getElementById("preview-quantity-count").textContent = String(quantity);
  document.getElementById("preview-minus").setAttribute("aria-label", "Remove one " + product.name);
  document.getElementById("preview-plus").setAttribute("aria-label", "Add one " + product.name);
}

function closeProductPreview() {
  productPreviewLayer.classList.remove("is-open");
  productPreviewLayer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (previewReturnFocus?.isConnected) previewReturnFocus.focus();
}

function setBusy(isBusy) {
  const button = document.getElementById("submit-order");
  button.disabled = isBusy;
  if (isBusy) button.textContent = "Connecting to Razorpay…";
  else updateCheckoutSummary();
}

async function startRazorpayCheckout(formData) {
  const message = document.getElementById("payment-message");
  message.textContent = "";
  setBusy(true);
const customerName = formData.customerName || window.HickeyAuth?.user?.name || "";
  const customerEmail = formData.email || window.HickeyAuth?.user?.email || "";
  try {
    const orderResponse = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: Object.entries(basket).map(([id, quantity]) => ({ id, quantity })),
  customerName,      
        address: formData.address,
        phone: formData.phone
      })
    });
    const orderData = await orderResponse.json().catch(() => null);
    if (!orderResponse.ok) {
      throw new Error(orderData?.error || "We couldn't create your payment order. Please try again.");
    }
    if (!window.Razorpay) {
      throw new Error("Razorpay Checkout did not load. Check your connection and try again.");
    }

    let paymentSubmitted = false;
    const contactDigits = String(formData.phone || window.HickeyAuth?.user?.phone || "").replace(/\D/g, "");
    const contact = String(formData.phone || window.HickeyAuth?.user?.phone || "").trim().startsWith("+") ? "+" + contactDigits : (contactDigits ? "+91" + contactDigits : "");
    const checkout = new window.Razorpay({
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "Hickey",
      description: "Hickey order " + orderData.receipt,
      order_id: orderData.order_id,
      prefill: { name: customerName, email: customerEmail, contact },
      readonly: { name: Boolean(customerName), email: Boolean(customerEmail), contact: Boolean(contact) },
      notes: { order_ref: orderData.receipt },
      theme: { color: "#ef234c" },
      modal: {
        ondismiss: () => {
          if (!paymentSubmitted) {
            message.textContent = "Checkout closed. Your order is still pending, and no payment confirmation was received.";
            setBusy(false);
          }
        }
      },
      handler: async (paymentDetails) => {
        paymentSubmitted = true;
        try {
          const verificationResponse = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paymentDetails)
          });
          const verification = await verificationResponse.json().catch(() => null);
          if (!verificationResponse.ok || verification?.verified !== true) {
            throw new Error(verification?.error || "Razorpay has not confirmed this payment yet.");
          }
          showSuccess(verification.orderRef);
          showToast("Payment confirmed. Your order is on its way.");
        } catch (error) {
          message.textContent = "Payment was submitted, but we couldn't confirm it yet. Please don't pay again. Contact Hickey with order " + orderData.receipt + ". " + error.message;
          setBusy(false);
        }
      }
    });

    checkout.on("payment.failed", (event) => {
      const description = event?.error?.description;
      message.textContent = description || "Razorpay couldn't complete that payment. You can retry in the checkout window.";
      showToast("Payment didn't go through. You can try again.");
    });
    checkout.open();
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "We couldn't start secure checkout. Please try again.";
    setBusy(false);
  }
}

function bindProductGridEvents(gridElement) {
  if (!gridElement) return;
  gridElement.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-product-action]");
    if (quantityButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = quantityButton.closest(".product-card")?.dataset.productId;
      if (id) {
        if (quantityButton.dataset.productAction === "increase") addToBasket(id);
        else changeQuantity(id, -1);
      }
      return;
    }
    const button = event.target.closest("[data-add]");
    if (button) {
      event.stopPropagation();
      addToBasket(button.dataset.add);
      return;
    }
    const card = event.target.closest(".product-card");
    if (card) openProductPreview(card);
  });

  gridElement.addEventListener("keydown", (event) => {
    const card = event.target.closest(".product-card");
    if (!card || event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openProductPreview(card);
  });
}

bindProductGridEvents(document.getElementById("product-grid"));
bindProductGridEvents(document.getElementById("sticker-showcase"));

// --- Collection Switcher & 60-Sticker Categorized Showcase (Randomized + High-FPS Motion) ---
const STICKER_PACK_META = {
  "Campus & Hostel": { subtitle: "Attendance math, dorm life, and 2 AM Maggi runs.", accent: "#45baf0" },
  "Internet & Slang": { subtitle: "Chronically online phrases made peel-and-stick.", accent: "#ed2442" },
  "Caffeine & Survival": { subtitle: "Diet Coke, cutting chai, and zero-sleep energy.", accent: "#f59e0b" },
  "Cats & Chaos": { subtitle: "Orange braincell lore and campus feline royalty.", accent: "#a855f7" },
  "Aesthetic & Badges": { subtitle: "Signature Hickey seals and clean vinyl stamps.", accent: "#10b981" }
};

let activeCollection = "keychains";
let activeStickerPack = "All";
let shuffledPackOrder = [];
let shuffledByPack = new Map();
let stickerCategoryObserver = null;

function shuffleArray(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomizeStickerOrder() {
  const allItems = window.HickeyStickers?.items || [];
  const packs = (window.HickeyStickers?.packs || []).filter((p) => p !== "All");
  shuffledPackOrder = shuffleArray(packs);
  shuffledByPack = new Map();
  for (const pack of shuffledPackOrder) {
    const inPack = allItems.filter((item) => item.pack === pack);
    shuffledByPack.set(pack, shuffleArray(inPack));
  }
}

function positionPackIndicator(animate = true) {
  const wrap = document.getElementById("sticker-pack-filters");
  if (!wrap) return;
  let indicator = wrap.querySelector(".pack-pill-indicator");
  const activeBtn = wrap.querySelector(".pack-pill.is-active");
  if (!activeBtn) return;
  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "pack-pill-indicator";
    indicator.setAttribute("aria-hidden", "true");
    wrap.prepend(indicator);
  }
  if (!animate) indicator.style.transition = "none";
  const x = activeBtn.offsetLeft;
  const y = activeBtn.offsetTop;
  const w = activeBtn.offsetWidth;
  const h = activeBtn.offsetHeight;
  indicator.style.width = w + "px";
  indicator.style.height = h + "px";
  indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (!animate) {
    indicator.offsetHeight;
    indicator.style.transition = "";
  }
}

function getOrderedFilterPacks() {
  return ["All", ...shuffledPackOrder];
}

function setActiveCollection(nextCollection, options = {}) {
  const valid = ["keychains", "stickers", "all"];
  const previous = activeCollection;
  activeCollection = valid.includes(nextCollection) ? nextCollection : "keychains";
  const keychainsPanel = document.getElementById("panel-keychains");
  const stickersPanel = document.getElementById("panel-stickers");
  if (keychainsPanel) keychainsPanel.hidden = activeCollection === "stickers";
  if (stickersPanel) stickersPanel.hidden = activeCollection === "keychains";

  document.querySelectorAll("[data-collection-tab]").forEach((tab) => {
    const isActive = tab.dataset.collectionTab === activeCollection;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  if (activeCollection === "stickers" || activeCollection === "all") {
    if (previous !== activeCollection || !shuffledPackOrder.length) {
      randomizeStickerOrder();
      renderStickerPackFilters();
    }
    renderStickers({ direction: "up" });
    requestAnimationFrame(() => positionPackIndicator(false));
  }
  if (options.scroll) {
    document.getElementById("treasury")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderStickerPackFilters() {
  const wrap = document.getElementById("sticker-pack-filters");
  const allItems = window.HickeyStickers?.items || [];
  const packs = getOrderedFilterPacks();
  if (!wrap || !packs.length) return;
  wrap.innerHTML = '<span class="pack-pill-indicator" aria-hidden="true"></span>' + packs.map((pack) => {
    const count = pack === "All" ? allItems.length : (shuffledByPack.get(pack)?.length || 0);
    const isActive = pack === activeStickerPack;
    return '<button class="pack-pill' + (isActive ? ' is-active' : '') + '" type="button" role="tab" data-pack="' + pack + '" aria-selected="' + isActive + '">' + pack + ' <span>' + count + '</span></button>';
  }).join("");
  requestAnimationFrame(() => positionPackIndicator(false));
}

function renderStickerCardMarkup(item, index) {
  const badgeHtml = item.badge ? '<span class="badge sticker-badge">' + item.badge + '</span>' : "";
  const staggerIndex = Math.min(index, 14);
  return '<article class="product-card sticker-card" style="--card-i:' + staggerIndex + '" data-product-id="' + item.id + '" tabindex="0" role="button" aria-haspopup="dialog" aria-label="View ' + item.title + ' sticker details">' +
    '<div class="product-photo sticker-stage">' + badgeHtml +
    '<img src="' + item.image + '" alt="' + item.title + ' die-cut vinyl sticker" loading="lazy">' +
    '<button class="add-button" data-add="' + item.id + '" aria-label="Add ' + item.name + ' to your basket">+</button></div>' +
    '<div class="product-info sticker-info"><span class="sticker-pack-tag">' + item.pack + '</span><h3>' + item.title + '</h3><p>' + item.description + '</p><div class="product-price"><strong>' + rupees.format(item.price) + '</strong></div></div>' +
    '</article>';
}

function observeStickerCategories(showcase) {
  if (stickerCategoryObserver) {
    stickerCategoryObserver.disconnect();
    stickerCategoryObserver = null;
  }
  const groups = Array.from(showcase.querySelectorAll(".sticker-category-group"));
  if (!groups.length) return;

  if (!("IntersectionObserver" in window)) {
    groups.forEach((group) => group.classList.add("is-revealed"));
    return;
  }

  stickerCategoryObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        stickerCategoryObserver?.unobserve(entry.target);
      }
    });
  }, { threshold: 0.04, rootMargin: "80px 0px -30px 0px" });

  groups.forEach((group, idx) => {
    if (idx === 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => group.classList.add("is-revealed"));
      });
    } else {
      stickerCategoryObserver.observe(group);
    }
  });
}

function renderStickers(options = {}) {
  const showcase = document.getElementById("sticker-showcase");
  const countEl = document.getElementById("sticker-count-label");
  if (!showcase || !shuffledPackOrder.length) return;

  const direction = options.direction || "up";
  const packsToShow = activeStickerPack === "All" ? shuffledPackOrder : [activeStickerPack];
  const totalShown = packsToShow.reduce((sum, pack) => sum + (shuffledByPack.get(pack)?.length || 0), 0);

  if (countEl) {
    countEl.textContent = activeStickerPack === "All"
      ? totalShown + " stickers · " + packsToShow.length + " categories"
      : totalShown + " stickers in " + activeStickerPack;
  }

  showcase.dataset.slideDir = direction;
  showcase.innerHTML = packsToShow.map((pack, groupIndex) => {
    const items = shuffledByPack.get(pack) || [];
    const meta = STICKER_PACK_META[pack] || { subtitle: "Die-cut waterproof vinyl drops.", accent: "#ed2442" };
    const num = String(groupIndex + 1).padStart(2, "0");
    return '<section class="sticker-category-group" style="--cat-accent:' + meta.accent + '" data-category-group="' + pack + '">' +
      '<header class="sticker-cat-head">' +
        '<div class="sticker-cat-title-wrap">' +
          '<span class="sticker-cat-num">' + num + '</span>' +
          '<div><h4>' + pack + '</h4><p>' + meta.subtitle + '</p></div>' +
        '</div>' +
        '<span class="sticker-cat-count">' + items.length + ' stickers</span>' +
      '</header>' +
      '<div class="sticker-cat-line" aria-hidden="true"></div>' +
      '<div class="sticker-grid">' + items.map((item, idx) => renderStickerCardMarkup(item, idx)).join("") + '</div>' +
    '</section>';
  }).join("");

  renderProductControls();
  observeStickerCategories(showcase);
}

document.addEventListener("click", (event) => {
  const switcher = event.target.closest("[data-switch-collection]");
  if (switcher) {
    const next = switcher.dataset.switchCollection;
    const isAnchor = switcher.tagName === "A";
    if (isAnchor) event.preventDefault();
    setActiveCollection(next, { scroll: isAnchor });
    return;
  }
  const packBtn = event.target.closest("[data-pack]");
  if (packBtn) {
    const nextPack = packBtn.dataset.pack;
    if (nextPack === activeStickerPack) return;
    const ordered = getOrderedFilterPacks();
    const prevIdx = ordered.indexOf(activeStickerPack);
    const nextIdx = ordered.indexOf(nextPack);
    const direction = nextIdx > prevIdx ? "right" : "left";
    activeStickerPack = nextPack;

    document.querySelectorAll("#sticker-pack-filters .pack-pill").forEach((btn) => {
      const isAct = btn.dataset.pack === activeStickerPack;
      btn.classList.toggle("is-active", isAct);
      btn.setAttribute("aria-selected", String(isAct));
    });
    positionPackIndicator(true);
    renderStickers({ direction });
  }
});

window.addEventListener("resize", () => positionPackIndicator(false), { passive: true });

randomizeStickerOrder();
renderStickerPackFilters();
if (window.location.hash === "#stickers") setActiveCollection("stickers");
else setActiveCollection("keychains");
document.querySelectorAll(".product-card").forEach((card) => {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-haspopup", "dialog");
  card.setAttribute("aria-label", "View " + (card.querySelector(".product-info h3")?.textContent || "product") + " details");
});

document.getElementById("close-product-preview").addEventListener("click", closeProductPreview);
productPreviewLayer.addEventListener("click", (event) => {
  if (event.target === productPreviewLayer) closeProductPreview();
});
document.getElementById("preview-add").addEventListener("click", () => {
  if (previewProductId) addToBasket(previewProductId);
});
document.getElementById("preview-minus").addEventListener("click", () => {
  if (previewProductId) changeQuantity(previewProductId, -1);
});
document.getElementById("preview-plus").addEventListener("click", () => {
  if (previewProductId) addToBasket(previewProductId);
});

const faqItems = Array.from(document.querySelectorAll(".faq-item"));
const faqOpenCount = document.getElementById("faq-open-count");
const faqCounter = document.querySelector(".faq-counter");
const faqAnswerCard = document.getElementById("faq-answer-card");
let faqScrollTimer;
function animateFaqOdometer() {
  faqCounter?.classList.remove("is-changing");
  requestAnimationFrame(() => faqCounter?.classList.add("is-changing"));
}
function animateFaqAnswer() {
  faqAnswerCard?.classList.remove("is-changing");
  requestAnimationFrame(() => faqAnswerCard?.classList.add("is-changing"));
}
function selectFaqItem(item) {
  if (!item) return;
  faqItems.forEach((question) => question.setAttribute("aria-pressed", String(question === item)));
  if (faqOpenCount) faqOpenCount.textContent = item.dataset.faqIndex || "01";
  document.getElementById("faq-answer-label").textContent = "NOW READING · QUESTION " + (item.dataset.faqIndex || "01");
  document.getElementById("faq-selected-question").textContent = item.querySelector(".faq-question").textContent;
  document.getElementById("faq-selected-answer").textContent = item.dataset.answer;
  animateFaqOdometer();
  animateFaqAnswer();
}
faqItems.forEach((item) => item.addEventListener("click", () => selectFaqItem(item)));
document.getElementById("faq-list").addEventListener("scroll", () => {
  clearTimeout(faqScrollTimer);
  faqScrollTimer = setTimeout(() => {
    if (!faqItems.length || !faqOpenCount) return;
    const list = document.getElementById("faq-list");
    const pitch = faqItems[0].offsetHeight + parseFloat(getComputedStyle(list).rowGap || "0");
    const index = Math.min(faqItems.length - 1, Math.max(0, Math.round(list.scrollTop / pitch)));
    faqOpenCount.textContent = faqItems[index].dataset.faqIndex;
    animateFaqOdometer();
  }, 90);
}, { passive: true });
document.querySelector(".faq-window").addEventListener("wheel", (event) => {
  if (event.target.closest("#faq-list") || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
  const list = document.getElementById("faq-list");
  const canScroll = event.deltaY < 0 ? list.scrollTop > 0 : list.scrollTop + list.clientHeight < list.scrollHeight - 1;
  if (!canScroll) return;
  event.preventDefault();
  list.scrollTop += event.deltaY;
}, { passive: false });
selectFaqItem(faqItems[0]);

document.getElementById("basket-items").addEventListener("click", (event) => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  if (quantityButton) changeQuantity(quantityButton.dataset.quantity, Number(quantityButton.dataset.change));
  if (removeButton) {
    delete basket[removeButton.dataset.remove];
    saveBasket();
  }
});

document.getElementById("open-bag").addEventListener("click", openDrawer);
document.getElementById("close-bag").addEventListener("click", closeDrawer);
document.getElementById("empty-shop").addEventListener("click", () => {
  closeDrawer();
  document.getElementById("treasury").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("start-checkout").addEventListener("click", openCheckout);
document.getElementById("close-checkout").addEventListener("click", closeCheckout);
document.getElementById("continue-shopping").addEventListener("click", () => {
  closeCheckout();
  document.getElementById("treasury").scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll("[data-contact-type]").forEach((button) => {
  button.addEventListener("click", () => openContact(button.dataset.contactType, button));
});
document.getElementById("close-contact").addEventListener("click", closeContact);
contactLayer.addEventListener("click", (event) => {
  if (event.target === contactLayer) closeContact();
});
contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const noteEl = document.getElementById("contact-note");
  if (submitBtn) submitBtn.disabled = true;
  if (noteEl) noteEl.textContent = "Sending your message directly to our team…";

  const fields = Object.fromEntries(new FormData(contactForm).entries());
  const payload = {
    type: contactType,
    message: fields.message,
    name: fields.name || window.HickeyAuth?.user?.name || "",
    email: window.HickeyAuth?.user?.email || "",
    quantity: contactType === "custom" ? fields.quantity : ""
  };

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not send message.");
    if (noteEl) noteEl.textContent = data.message || "Message sent! We received it directly.";
    contactForm.reset();
    showToast("Message sent directly to our team!");
    setTimeout(() => closeContact(), 1600);
  } catch (err) {
    if (noteEl) noteEl.textContent = err.message || "Could not send message. Please try again.";
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!checkoutForm.reportValidity()) return;
  const formData = Object.fromEntries(new FormData(checkoutForm).entries());
  await startRazorpayCheckout(formData);
});

scrim.addEventListener("click", () => {
  if (checkoutLayer.classList.contains("is-open")) closeCheckout();
  else closeDrawer();
});
checkoutLayer.addEventListener("click", (event) => {
  if (event.target === checkoutLayer) closeCheckout();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (contactLayer.classList.contains("is-open")) closeContact();
    else if (productPreviewLayer.classList.contains("is-open")) closeProductPreview();
    else {
      closeCheckout();
      closeDrawer();
    }
  }
});

let scrollTicking = false;
const cloudTransitions = [...document.querySelectorAll("[data-cloud-scroll]")];

const cloudNodes = cloudTransitions.map((transition) => ({
  el: transition,
  left: transition.querySelector(".cloud-form-left"),
  right: transition.querySelector(".cloud-form-right"),
  particles: Array.from(transition.querySelectorAll(".cloud-particle"))
}));

function updateCloudParallax() {
  const viewportHeight = window.innerHeight || 1;
  const travel = Math.min((window.innerWidth || 1) * 0.32, 420);

  for (const node of cloudNodes) {
    const rect = node.el.getBoundingClientRect();
    if (rect.top > viewportHeight * 1.15 || rect.top < -viewportHeight * 0.45) continue;
    const progress = Math.min(1, Math.max(0, (viewportHeight * 0.82 - rect.top) / (viewportHeight + 1)));
    const presence = Math.sin(progress * Math.PI);
    const drift = (progress - 0.5) * travel;

    if (node.left) {
      node.left.style.transform = `translate3d(${drift - presence * 135}px, ${-presence * 38}px, 0) scale(${0.72 + presence * 0.72})`;
      node.left.style.opacity = String(0.12 + presence * 0.9);
    }
    if (node.right) {
      node.right.style.transform = `translate3d(${-drift + presence * 125}px, ${presence * 34}px, 0) scale(${0.68 + presence * 0.76})`;
      node.right.style.opacity = String(0.1 + presence * 0.94);
    }
    node.particles.forEach((particle, index) => {
      const direction = index % 2 ? 1 : -1;
      const spread = (1 - presence) * direction * (90 + index * 50);
      particle.style.transform = `translate3d(${drift * direction * (0.35 + index * 0.1) + spread}px, ${Math.cos(progress * Math.PI * 2 + index) * 28}px) scale(${0.45 + presence * 1.4})`;
      particle.style.opacity = String(presence * (index ? 0.82 : 1));
    });
  }
}

let marqueeInView = false;
let marqueeOffset = 0;
let marqueeLastScrollY = window.scrollY;
const marqueeTrackEl = document.getElementById("marquee-track");
let cachedMarqueeLoopWidth = marqueeTrackEl?.querySelector(".marquee-flow")?.offsetWidth || 1;

function updateMarquee(trackScroll = true) {
  if (!marqueeTrackEl) return;
  if (!trackScroll) {
    cachedMarqueeLoopWidth = marqueeTrackEl.querySelector(".marquee-flow")?.offsetWidth || 1;
  }
  const currentScrollY = window.scrollY;
  if (trackScroll && !marqueeInView) {
    marqueeLastScrollY = currentScrollY;
    return;
  }
  if (trackScroll && marqueeInView) marqueeOffset -= (currentScrollY - marqueeLastScrollY) * 0.82;
  marqueeLastScrollY = currentScrollY;
  const offset = marqueeOffset % (cachedMarqueeLoopWidth || 1);
  marqueeTrackEl.style.setProperty("--scroll-marquee-offset", `${offset}px`);
}

const fireflyLayer = document.getElementById("firefly-layer");
if (fireflyLayer) {
  let seed = 731;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 28; i += 1) {
    const firefly = document.createElement("span");
    firefly.className = "firefly";
    firefly.style.setProperty("--x", `${5 + random() * 90}%`);
    firefly.style.setProperty("--y", `${8 + random() * 82}%`);
    firefly.style.setProperty("--size", `${3 + random() * 4}px`);
    firefly.style.setProperty("--duration", `${2.3 + random() * 4.2}s`);
    firefly.style.setProperty("--delay", `${-random() * 5}s`);
    fireflyLayer.appendChild(firefly);
  }
}

window.addEventListener("scroll", () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    const current = window.scrollY;
    if (current < 40 || current < lastScrollY - 6) {
      nav.classList.remove("nav-away");
      themeToggle?.classList.remove("nav-away");
    } else if (current > lastScrollY + 8 && current > 150) {
      nav.classList.add("nav-away");
      themeToggle?.classList.add("nav-away");
    }
    lastScrollY = current;
    updateCloudParallax();
    updateMarquee();
    scrollTicking = false;
  });
}, { passive: true });
window.addEventListener("resize", () => { updateCloudParallax(); updateMarquee(false); }, { passive: true });
updateCloudParallax();
updateMarquee(false);

const hero = document.querySelector(".hero");
if (hero && "IntersectionObserver" in window) {
  const heroObserver = new IntersectionObserver(([entry]) => {
    hero.classList.toggle("is-active", entry.isIntersecting);
  }, { threshold: 0.12 });
  heroObserver.observe(hero);
} else if (hero) hero.classList.add("is-active");

if ("IntersectionObserver" in window) {
  const isMobileViewport = () => window.matchMedia("(max-width: 760px)").matches;
  const marquee = document.querySelector(".marquee");
  if (marquee) {
    const marqueeObserver = new IntersectionObserver(([entry]) => {
      marqueeInView = entry.isIntersecting;
      marquee.classList.toggle("is-in-view", marqueeInView);
      marqueeLastScrollY = window.scrollY;
    }, { threshold: 0.01 });
    marqueeObserver.observe(marquee);
  }

  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.05, rootMargin: "40px 0px 20px 0px" });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

  const tileObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const grid = entry.target.parentElement;
      const tiles = Array.from(grid?.querySelectorAll(".snap-tile") || []);
      const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
      const tileIndex = tiles.indexOf(entry.target);
      const delay = grid?.classList.contains("faq-list")
        ? (tileIndex % 5) * 35
        : (tileIndex % Math.max(1, columns)) * 35;
      entry.target.style.setProperty("--snap-delay", `${delay}ms`);
      if (entry.target.matches(".faq-item")) entry.target.style.setProperty("--faq-delay", `${delay}ms`);
      entry.target.classList.add("is-snapped");
      // Once snapped/revealed, latch it permanently so scrolling back and forth never glitches or jumps!
      tileObserver.unobserve(entry.target);
    }
  }), { threshold: 0.04, rootMargin: "60px 0px 40px 0px" });
  document.querySelectorAll(".snap-tile").forEach((element) => tileObserver.observe(element));
} else {
  document.querySelector(".marquee")?.classList.add("is-in-view");
  marqueeInView = true;
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
  document.querySelectorAll(".snap-tile").forEach((element) => element.classList.add("is-snapped"));
}

document.getElementById("year").textContent = new Date().getFullYear();
renderBasket();

window.addEventListener("hickey:auth-ready", (event) => {
  const action = event.detail?.action;
  if (action?.type === "add") addToBasket(action.id);
  if (action?.type === "checkout") openCheckout();
});

window.HickeyAuth?.init({
  getBasket: () => basket,
  setBasket: (next) => {
    basket = next;
    saveBasket();
  }
});

// Theme slider toggle with persistence
const themeToggle = document.getElementById("theme-toggle");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const LOGO_VERSION = "1795703893";
function syncLogoTheme(isDark) {
  const src = isDark
    ? `assets/hickey-logo-dark-opt.png?v=${LOGO_VERSION}`
    : `assets/hickey-logo-opt.png?v=${LOGO_VERSION}`;
  document.querySelectorAll(".hickey-logo, .footer-logo img, .checkout-brand img").forEach((img) => {
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  });
}
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  if (themeToggle) themeToggle.setAttribute("aria-checked", String(isDark));
  if (themeMeta) themeMeta.setAttribute("content", isDark ? "#080d18" : "#f3f6ff");
  syncLogoTheme(isDark);
  try { localStorage.setItem("hickey-theme", isDark ? "dark" : "light"); } catch (_) {}
}
if (themeToggle) {
  let initialTheme = "light";
  try { initialTheme = localStorage.getItem("hickey-theme") || "light"; } catch (_) {}
  applyTheme(initialTheme);
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}
