const PRODUCTS = {
  "kathor-clock": { name: "The Rohtak Clock", price: 69, image: "assets/keychain-products/01-rohtak-standard-time.png" },
  pda: { name: "PDA Tree", price: 69, image: "assets/keychain-products/02-pda-campus.png" },
  "submit-mode": { name: "Spiderman", price: 69, image: "assets/keychain-products/03-atp-submit.png" },
  "clock-it": { name: "Clock It", price: 69, image: "assets/keychain-products/04-clock-it.png" },
  "coke-paglu": { name: "Diet Coke Paglu", price: 69, image: "assets/keychain-products/05-diet-coke-paglu.png" },
  cooks: { name: "Cooked", price: 69, image: "assets/keychain-products/06-cooks.png" },
  "proxy-pass": { name: "Claude Proxt mt laga", price: 69, image: "assets/keychain-products/07-proxy-mat-laga.png" },
  baddie: { name: "The Baddie Club", price: 69, image: "assets/keychain-products/08-baddie.png" },
  "kathor-land": { name: "Kathor Land", price: 69, image: "assets/keychain-products/09-kathor-land.png" },
  nonchalant: { name: "Non Chalant", price: 69, image: "assets/keychain-products/11-nonchalant.png" },
  "two-friends": { name: "Couple Design", price: 99, image: "assets/keychain-products/12-two-friends.png" },
  "campus-cat-nap": { name: "CAT Whore", price: 69, image: "assets/keychain-products/13-cat-whore-campus-nap.png" },
  "clinger-cat-club": { name: "Gingerrrrr", price: 69, image: "assets/keychain-products/14-clinger-cat-club.png" },
  "same-old-day": { name: "Same Old Day", price: 69, image: "assets/keychain-products/15-same-old-day.png" }
};

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
  document.getElementById("contact-note").textContent = "Your email app will open with this message ready to send.";
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
  const image = card.querySelector(".product-photo img");
  document.getElementById("preview-image").src = product.image;
  document.getElementById("preview-image").alt = image?.alt || product.name;
  document.getElementById("preview-title").textContent = product.name;
  document.getElementById("preview-description").textContent = card.querySelector(".product-info p")?.textContent || "";
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
    const contactDigits = String(formData.phone || "").replace(/\D/g, "");
    const contact = String(formData.phone || "").trim().startsWith("+") ? "+" + contactDigits : "+91" + contactDigits;
    const checkout = new window.Razorpay({
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "Hickey",
      description: "Hickey order " + orderData.receipt,
      order_id: orderData.order_id,
  prefill: { name: customerName, email: customerEmail, contact },    
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

document.getElementById("product-grid").addEventListener("click", (event) => {
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
    addToBasket(button.dataset.add);
    return;
  }
  const card = event.target.closest(".product-card");
  if (card) openProductPreview(card);
});

document.getElementById("product-grid").addEventListener("keydown", (event) => {
  const card = event.target.closest(".product-card");
  if (!card || event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  openProductPreview(card);
});
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
contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const fields = Object.fromEntries(new FormData(contactForm).entries());
  const details = [
    "Message:", fields.message,
    fields.name ? "\nName: " + fields.name : "",
    window.HickeyAuth?.user?.email ? "\nReply to: " + window.HickeyAuth.user.email : "",
    contactType === "custom" && fields.quantity ? "\nEstimated small-run quantity: " + fields.quantity : ""
  ].filter(Boolean).join("\n");
  const copy = contactCopy[contactType];
  const mailto = "mailto:hello@hickey.store?subject=" + encodeURIComponent(copy.subject) + "&body=" + encodeURIComponent(details);
  window.location.href = mailto;
  document.getElementById("contact-note").textContent = "Your email app should open now. Review the message and press Send to get it to us.";
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

function updateCloudParallax() {
  const viewportHeight = window.innerHeight || 1;
  const travel = Math.min((window.innerWidth || 1) * 0.32, 420);

  cloudTransitions.forEach((transition) => {
    const rect = transition.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (viewportHeight * 0.82 - rect.top) / (viewportHeight + 1)));
    const presence = Math.sin(progress * Math.PI);
    const drift = (progress - 0.5) * travel;
    const left = transition.querySelector(".cloud-form-left");
    const right = transition.querySelector(".cloud-form-right");
    const particles = transition.querySelectorAll(".cloud-particle");

    if (left) {
      left.style.transform = `translate3d(${drift - presence * 135}px, ${-presence * 38}px, 0) scale(${0.72 + presence * 0.72})`;
      left.style.opacity = String(0.12 + presence * 0.9);
    }
    if (right) {
      right.style.transform = `translate3d(${-drift + presence * 125}px, ${presence * 34}px, 0) scale(${0.68 + presence * 0.76})`;
      right.style.opacity = String(0.1 + presence * 0.94);
    }
    particles.forEach((particle, index) => {
      const direction = index % 2 ? 1 : -1;
      const spread = (1 - presence) * (index % 2 ? 1 : -1) * (90 + index * 50);
      particle.style.transform = `translate3d(${drift * direction * (0.35 + index * 0.1) + spread}px, ${Math.cos(progress * Math.PI * 2 + index) * 28}px) scale(${0.45 + presence * 1.4})`;
      particle.style.opacity = String(presence * (index ? 0.82 : 1));
    });
  });
}

let marqueeInView = false;
let marqueeOffset = 0;
let marqueeLastScrollY = window.scrollY;

function updateMarquee(trackScroll = true) {
  const track = document.getElementById("marquee-track");
  if (!track) return;
  const flow = track.querySelector(".marquee-flow");
  const loopWidth = flow?.getBoundingClientRect().width || 1;
  const currentScrollY = window.scrollY;
  if (trackScroll && marqueeInView) marqueeOffset -= (currentScrollY - marqueeLastScrollY) * 0.82;
  marqueeLastScrollY = currentScrollY;
  const offset = marqueeOffset % loopWidth;
  track.style.setProperty("--scroll-marquee-offset", `${offset}px`);
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
    if (current < 40 || current < lastScrollY - 6) nav.classList.remove("nav-away");
    else if (current > lastScrollY + 8 && current > 150) nav.classList.add("nav-away");
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
    if (isMobileViewport()) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
      return;
    }
    entry.target.classList.toggle("is-visible", entry.isIntersecting);
  }), { threshold: isMobileViewport() ? 0.05 : 0.12, rootMargin: isMobileViewport() ? "40px 0px 20px 0px" : "0px 0px -5% 0px" });
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
      if (isMobileViewport()) {
        entry.target.classList.add("is-snapped");
        tileObserver.unobserve(entry.target);
        return;
      }
    }
    if (!isMobileViewport()) {
      entry.target.classList.toggle("is-snapped", entry.isIntersecting);
    }
  }), { threshold: isMobileViewport() ? 0.04 : 0.16, rootMargin: isMobileViewport() ? "60px 0px 40px 0px" : "0px 0px -4% 0px" });
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
