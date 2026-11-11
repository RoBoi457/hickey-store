(() => {
  const $ = (id) => document.getElementById(id);
  const layer = $("account-layer");
  let user = null;
  let initPromise = Promise.resolve();
  let callbacks = null;
  let authMode = "login";
  let pendingAction = null;
  let returnFocus = null;
  let googleClientId = "";
  let googleNonce = "";
  let cartWriteQueue = Promise.resolve();

  function setStatus(message, profile = false) {
    const target = $(profile ? "account-profile-status" : "account-status");
    if (target) target.textContent = message || "";
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers
    });
    const data = await response.json().catch(() => ({ error: "Unexpected response from the account service." }));
    if (!response.ok) throw new Error(data.error || "The account request could not be completed.");
    return data;
  }

  function setUser(next) {
    user = next && typeof next.id === "string" && typeof next.email === "string"
      ? { id: next.id, name: (next.name || next.email.split("@")[0] || "").trim(), email: next.email, phone: next.phone || "", address: next.address || "" }
      : null;
    const button = $("open-account");
    if (button) {
      const label = user ? "My account (" + (user.name || user.email) + ")" : "Sign in or create an account";
      button.setAttribute("aria-label", label);
      button.title = user ? "Account & Sign out (" + (user.name || user.email) + ")" : "Sign in";
      button.classList.toggle("is-signed-in", Boolean(user));
    }
  }

  function updateAuthMode(mode) {
    authMode = mode === "signup" ? "signup" : "login";
    const signup = authMode === "signup";
    $("account-login-tab").setAttribute("aria-pressed", String(!signup));
    $("account-signup-tab").setAttribute("aria-pressed", String(signup));
    $("account-title").textContent = signup ? "Create your Hickey account." : "Sign in to your account.";
    $("account-description").textContent = signup
      ? "Enter your details once — your basket and checkout will use them automatically."
      : "Sign in with your email or username, or create a new account below.";

    const nameField = $("account-name-field");
    const nameInput = $("account-name");
    if (nameField && nameInput) {
      nameField.hidden = !signup;
      nameInput.required = signup;
    }

    const emailLabel = $("account-email-label");
    const emailInput = $("account-email");
    if (emailLabel && emailInput) {
      emailLabel.textContent = signup ? "Email address" : "Email or username";
      emailInput.type = signup ? "email" : "text";
      emailInput.autocomplete = signup ? "email" : "username";
      emailInput.placeholder = signup ? "you@example.com" : "Email address or username";
    }

    $("account-password").autocomplete = signup ? "new-password" : "current-password";
    $("account-password").minLength = signup ? 6 : 1;
    $("account-password").placeholder = signup ? "Create a password (6+ characters)" : "Password";
    $("account-submit").textContent = signup ? "Create new account" : "Sign in";

    const switchText = $("account-switch-text");
    const switchBtn = $("account-switch-mode");
    if (switchText && switchBtn) {
      switchText.textContent = signup ? "Already have an account?" : "Logging in for the first time?";
      switchBtn.textContent = signup ? "Sign in" : "Create new account";
    }
    setStatus("");
  }

  function showLogin() {
    $("account-auth-view").hidden = false;
    $("account-profile-view").hidden = true;
    updateAuthMode(authMode);
    setTimeout(() => {
      const target = authMode === "signup" && $("account-name") ? $("account-name") : $("account-email");
      target?.focus();
    }, 80);
  }

  function showProfile() {
    $("account-auth-view").hidden = true;
    $("account-profile-view").hidden = false;
    if ($("account-name-display")) {
      $("account-name-display").textContent = user ? (user.name || user.email.split("@")[0]) : "";
    }
    $("account-email-display").textContent = user ? user.email : "";
    setStatus("");
    loadOrders();
  }

  function openModal() {
    if (!layer) return;
    returnFocus = document.activeElement;
    if (user) showProfile();
    else showLogin();
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (!layer) return;
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    pendingAction = null;
    if (!document.querySelector(".checkout-layer.is-open, .basket-drawer.is-open, .contact-layer.is-open, .product-preview-layer.is-open, .account-layer.is-open")) {
      document.body.classList.remove("modal-open");
    }
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
  }

  function dispatchAction(action) {
    if (!action) return;
    window.dispatchEvent(new CustomEvent("hickey:auth-ready", { detail: { action } }));
  }

  async function requestAuth(action = null) {
    try { await initPromise; } catch {}
    if (user) {
      if (action) dispatchAction(action);
      else openModal();
      return;
    }
    pendingAction = action;
    openModal();
  }

  function cleanBasket(value) {
    const clean = Object.create(null);
    if (!value || typeof value !== "object" || Array.isArray(value)) return clean;
    for (const [id, quantity] of Object.entries(value)) {
      if (/^[a-z0-9-]{1,80}$/.test(id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 99) clean[id] = quantity;
    }
    return clean;
  }

  async function syncBasket() {
    const data = await api("/api/cart");
    const remote = cleanBasket(data.items);
    const key = "hickey-cart-imported-v1-" + user.id;
    let merged = { ...remote };
    let imported = false;
    try { imported = localStorage.getItem(key) === "1"; } catch {}
    if (!imported && callbacks) {
      const legacy = cleanBasket(callbacks.getBasket());
      for (const [id, quantity] of Object.entries(legacy)) merged[id] = Math.min(99, (merged[id || ""] || 0) + quantity);
      try { localStorage.setItem(key, "1"); } catch {}
    }
    if (callbacks) callbacks.setBasket(merged);
  }

  async function loadOrders() {
    const list = $("account-orders-list");
    const failedBanner = $("account-failed-banner");
    if (!list || !user) return;
    list.replaceChildren();
    if (failedBanner) failedBanner.hidden = true;
    $("account-orders-empty").hidden = true;
    setStatus("Checking confirmed orders…", true);
    try {
      const data = await api("/api/account/orders");
      const orders = Array.isArray(data.orders) ? data.orders : [];
      const failed = Array.isArray(data.failed_orders) ? data.failed_orders : [];

      if (failedBanner && failed.length > 0) {
        failedBanner.hidden = false;
      }

      $("account-orders-empty").hidden = orders.length > 0;
      for (const order of orders) {
        const card = document.createElement("article");
        card.className = "account-order-card";
        const top = document.createElement("div");
        top.className = "account-order-top";
        const ref = document.createElement("strong");
        ref.textContent = order.order_ref || "Hickey order";
        const state = document.createElement("span");
        state.textContent = "Confirmed · Paid";
        state.className = "account-order-status";
        state.style.color = "#1ec773";
        state.style.fontWeight = "700";
        top.append(ref, state);
        const detail = document.createElement("p");
        const items = Array.isArray(order.items)
          ? order.items.map((item) => String(item.name || "Item") + " × " + (Number(item.quantity) || 1)).join(", ")
          : "";
        const created = order.created_at ? new Date(String(order.created_at).replace(" ", "T") + "Z") : null;
        const date = created && !Number.isNaN(created.valueOf())
          ? created.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "";
        detail.textContent = [date, items].filter(Boolean).join(" · ");
        const amount = document.createElement("b");
        amount.textContent = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
          .format(Number(order.amount_rupees) || 0);
        card.append(top, detail, amount);
        list.append(card);
      }
      setStatus("", true);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function setupAccountDetails() {
    const toggleBtn = $("toggle-account-details");
    const form = $("account-details-form");
    const saveStatus = $("profile-save-status");
    if (!toggleBtn || !form) return;

    toggleBtn.addEventListener("click", () => {
      const isHidden = form.hidden;
      form.hidden = !isHidden;
      toggleBtn.textContent = isHidden ? "Close details" : "Edit details";
      if (isHidden && user) {
        $("profile-name").value = user.name || "";
        $("profile-email").value = user.email || "";
        $("profile-phone").value = user.phone || "";
        $("profile-address").value = user.address || "";
        if (saveStatus) saveStatus.textContent = "";
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = $("profile-save-btn");
      if (saveBtn) saveBtn.disabled = true;
      if (saveStatus) {
        saveStatus.style.color = "var(--muted)";
        saveStatus.textContent = "Saving account details…";
      }
      try {
        const payload = {
          name: $("profile-name").value.trim(),
          email: $("profile-email").value.trim(),
          phone: $("profile-phone").value.trim(),
          address: $("profile-address").value.trim()
        };
        const res = await api("/api/account/orders", {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        if (res.user) {
          setUser({ ...user, ...res.user });
          if ($("account-name-display")) $("account-name-display").textContent = res.user.name || res.user.email;
          if ($("account-email-display")) $("account-email-display").textContent = res.user.email;
        }
        if (saveStatus) {
          saveStatus.style.color = "#1ec773";
          saveStatus.textContent = "Account details updated successfully!";
        }
      } catch (err) {
        if (saveStatus) {
          saveStatus.style.color = "#c02538";
          saveStatus.textContent = err.message || "Could not save details.";
        }
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }

  async function finishAuth(nextUser) {
    setUser(nextUser);
    setStatus("Loading your saved basket…");
    try {
      await syncBasket();
    } catch (error) {
      setStatus(error.message);
    }
    const action = pendingAction;
    pendingAction = null;
    if (action) {
      closeModal();
      dispatchAction(action);
    } else {
      showProfile();
    }
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();
    const form = $("account-form");
    if (!form.reportValidity()) return;
    const submit = $("account-submit");
    submit.disabled = true;
    setStatus(authMode === "signup" ? "Creating your account…" : "Signing you in…");
    const formData = new FormData(form);
    try {
      const data = await api(authMode === "signup" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          password: String(formData.get("password") || "")
        })
      });
      form.reset();
      await finishAuth(data.user);
    } catch (error) {
      setStatus(error.message);
    } finally {
      submit.disabled = false;
    }
  }

  function makeNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    let binary = "";
    for (const value of bytes) binary += String.fromCharCode(value);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function onGoogleCredential(response) {
    if (!response || typeof response.credential !== "string") return;
    setStatus("Connecting your Google account…");
    try {
      const data = await api("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential, nonce: googleNonce })
      });
      await finishAuth(data.user);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function setupGoogleButton() {
    try {
      const config = await api("/api/auth/config");
      googleClientId = typeof config.googleClientId === "string" ? config.googleClientId : "";
    } catch {
      googleClientId = "";
    }
    if (!googleClientId) {
      $("google-signin").hidden = true;
      $("google-auth-unconfigured").hidden = false;
      return;
    }

    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        googleNonce = makeNonce();
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          nonce: googleNonce,
          callback: onGoogleCredential
        });
        const container = $("google-signin");
        const width = Math.max(240, Math.min(360, Math.floor(container.getBoundingClientRect().width || 320)));
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    $("google-signin").hidden = true;
    $("google-auth-unconfigured").hidden = false;
    $("google-auth-unconfigured").textContent = "Google sign-in couldn't load. Please try again later.";
  }

  async function signOut() {
    const previous = user;
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
    } catch {}
    setUser(null);
    if (previous) {
      try { localStorage.removeItem("hickey-cart-imported-v1-" + previous.id); } catch {}
    }
    if (callbacks) callbacks.setBasket({});
    $("account-form").reset();
    closeModal();
    setStatus("");
  }

  function init(nextCallbacks) {
    callbacks = nextCallbacks;
    $("account-form").addEventListener("submit", handleAccountSubmit);
    $("account-login-tab").addEventListener("click", () => updateAuthMode("login"));
    $("account-signup-tab").addEventListener("click", () => updateAuthMode("signup"));
    $("account-switch-mode")?.addEventListener("click", () => updateAuthMode(authMode === "signup" ? "login" : "signup"));
    $("close-account").addEventListener("click", closeModal);
    $("account-signout").addEventListener("click", signOut);
    $("account-signout-top")?.addEventListener("click", signOut);
    $("account-refresh-orders").addEventListener("click", loadOrders);
    $("open-account").addEventListener("click", () => requestAuth());
    layer.addEventListener("click", (event) => { if (event.target === layer) closeModal(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && layer.classList.contains("is-open")) closeModal();
    });

    initPromise = (async () => {
      try {
        const data = await api("/api/auth/me");
        if (data.user) {
          setUser(data.user);
          await syncBasket();
        }
      } catch {
        setUser(null);
      }
    })();
    setupAccountDetails();
    setupGoogleButton();
    return initPromise;
  }

  window.HickeyAuth = {
    init,
    get user() { return user; },
    get ready() { return initPromise; },
    request: requestAuth,
    isOpen: () => Boolean(layer?.classList.contains("is-open")),
    close: closeModal,
    persistCart(items) {
      if (!user) return cartWriteQueue;
      const snapshot = cleanBasket(items);
      cartWriteQueue = cartWriteQueue.catch(() => {}).then(async () => {
        await api("/api/cart", {
          method: "PUT",
          body: JSON.stringify({ items: snapshot }),
          keepalive: true
        });
      }).catch((error) => {
        if (layer.classList.contains("is-open")) setStatus(error.message, Boolean(user && $("account-profile-view") && !$("account-profile-view").hidden));
      });
      return cartWriteQueue;
    }
  };
})();
