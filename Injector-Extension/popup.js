/**
 * Selector presets bundled with the Hide-Elements feature. Originally lived
 * in templates.js as the "Remove Ads & Banners" script — merged here so the
 * extension has a single way to hide DOM nodes per site.
 */
const HIDE_PRESETS = {
  ads: [
    '[id*="ad-"]', '[id*="-ad"]', '[id*="_ad"]',
    '[id*="ads"]', '[id*="banner"]', '[id*="popup"]',
    '[class*="advert"]', '[class*="ads-"]', '[class*="-ads"]',
    '[class*="ad-container"]', '[class*="ad-wrapper"]',
    '[class*="banner-ads"]', '[class*="sponsored"]',
    '[class*="promo-banner"]', '[class*="sticky-ad"]',
    '[data-ad]', '[data-ad-slot]', '[data-google-query-id]',
    'ins.adsbygoogle',
  ],
  cookies: [
    '[class*="cookie-banner"]', '[id*="cookie-banner"]',
    '[class*="cookie-consent"]', '[id*="cookie-consent"]',
    '[class*="gdpr"]', '[id*="gdpr"]',
    '#onetrust-banner-sdk', '#CybotCookiebotDialog', '.cc-window',
  ],
  newsletters: [
    '[class*="newsletter-modal"]', '[id*="newsletter-modal"]',
    '[class*="subscribe-modal"]', '[id*="subscribe-modal"]',
    '[class*="signup-modal"]', '[class*="email-capture"]',
    '[class*="popup-newsletter"]',
  ],
};

class PopupManager {
  constructor() {
    this.scripts = {};
    this.lastRun = {};
    this.searchQuery = "";
    this.currentTab = null;
    this.activeTab = "scripts";
    this.init();
  }

  async init() {
    this.setupTabs();
    this.setupBottomBar();
    this.setupSearch();
    this.setupHideChips();
    this.setupAutoScrollControls();
    await this.loadTab();
  }

  /**
   * Auto-Scroll interactive controls in popup.
   *
   * Wires mode chips, direction chips, speed slider, and the enable toggle so
   * any change persists to chrome.storage AND propagates to content.js
   * immediately — no Save button needed for this tab. Content script in turn
   * auto-starts/stops the scroller based on `enabled`.
   */
  setupAutoScrollControls() {
    const toggle = document.getElementById("autoScrollToggle");
    const modeBtns = document.querySelectorAll(".as-mode-btn");
    const dirBtns = document.querySelectorAll(".as-dir-btn");
    const slider = document.getElementById("asSpeedSlider");
    const speedValue = document.getElementById("asSpeedValue");
    if (!toggle || !slider) return;

    const setActive = (group, attr, value) => {
      group.forEach((b) => b.classList.toggle("active", b.dataset[attr] === value));
    };

    this._asState = { enabled: false, mode: "smooth", dir: "down", speed: 120, stepPx: 200 };

    const saveAndApply = () => {
      if (!this.currentTab?.url) return;
      try {
        const { hostname } = new URL(this.currentTab.url);
        const settings = { ...this._asState };
        this.send(
          { action: "saveAutoScrollSettings", hostname, settings },
          () => {
            chrome.tabs.sendMessage(this.currentTab.id, {
              action: "applyAutoScrollSettings",
              settings,
            });
          },
        );
      } catch {}
    };

    toggle.addEventListener("change", () => {
      this._asState.enabled = toggle.checked;
      saveAndApply();
      this.toast(toggle.checked ? "Auto-scroll on ▶" : "Auto-scroll off", "success");
    });

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this._asState.mode = btn.dataset.mode;
        setActive(modeBtns, "mode", this._asState.mode);
        saveAndApply();
      });
    });
    dirBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this._asState.dir = btn.dataset.dir;
        setActive(dirBtns, "dir", this._asState.dir);
        saveAndApply();
      });
    });
    // Webkit <input type=range> doesn't fill the track up to the thumb natively
    // (only Firefox has ::-moz-range-progress). Paint a linear-gradient bg
    // from 0 → value% with the warn color, then idle bg after — keeps the
    // visual in sync with the slider value.
    const paintTrack = () => {
      const min = +slider.min || 0;
      const max = +slider.max || 100;
      const pct = ((+slider.value - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, var(--warn) 0%, var(--warn) ${pct}%, var(--card) ${pct}%, var(--card) 100%)`;
    };
    paintTrack();
    slider.addEventListener("input", () => {
      this._asState.speed = parseInt(slider.value, 10);
      speedValue.textContent = this._asState.speed;
      paintTrack();
    });
    // Save on release rather than every "input" event to avoid storage spam.
    slider.addEventListener("change", () => {
      saveAndApply();
    });
    // Expose for loadAutoScrollSettings to repaint after programmatic value set
    this._paintSpeedTrack = paintTrack;
  }

  /**
   * Hide-Elements Quick chips + Presets.
   *
   * Each chip carries either:
   *   - `data-add="<tag>"`        → single selector (e.g. iframe)
   *   - `data-preset="<key>"`     → list of selectors from HIDE_PRESETS
   *
   * Click toggles the selectors in/out of the textarea, auto-enables the
   * Hide toggle, and saves immediately so the page reflects the change.
   * The chip glows when all of its selectors are currently in the textarea.
   */
  setupHideChips() {
    const input = document.getElementById("hideInput");
    const enableToggle = document.getElementById("hideToggle");
    if (!input) return;

    const parse = (text) =>
      text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const itemsFor = (chip) =>
      chip.dataset.preset ? HIDE_PRESETS[chip.dataset.preset] || [] : [chip.dataset.add];

    const allPresent = (current, items) => {
      const set = new Set(current);
      return items.length > 0 && items.every((i) => set.has(i));
    };

    const refresh = () => {
      const current = parse(input.value);
      document.querySelectorAll(".hide-chip").forEach((chip) => {
        chip.classList.toggle("active", allPresent(current, itemsFor(chip)));
      });
    };

    document.querySelectorAll(".hide-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const items = itemsFor(chip);
        const current = parse(input.value);
        let next;
        if (allPresent(current, items)) {
          const remove = new Set(items);
          next = current.filter((c) => !remove.has(c));
        } else {
          const set = new Set(current);
          items.forEach((i) => set.add(i));
          next = [...set];
        }
        input.value = next.join(", ");
        chip.classList.add("flash");
        setTimeout(() => chip.classList.remove("flash"), 500);
        refresh();

        // Auto-enable Hide on this site and persist immediately so the page
        // reflects the change without an extra Save click.
        if (enableToggle && next.length > 0 && !enableToggle.checked) {
          enableToggle.checked = true;
        }
        this.saveHideSettings();
      });
    });

    // Keep chip states in sync when user types manually
    input.addEventListener("input", refresh);
  }

  setupSearch() {
    const input = document.getElementById("searchInput");
    const clear = document.getElementById("searchClear");
    if (!input) return;
    input.addEventListener("input", () => {
      this.searchQuery = input.value.trim().toLowerCase();
      clear.style.display = this.searchQuery ? "flex" : "none";
      this.renderScripts();
    });
    clear.addEventListener("click", () => {
      input.value = "";
      this.searchQuery = "";
      clear.style.display = "none";
      input.focus();
      this.renderScripts();
    });
  }

  /* ── TAB SWITCHING ── */
  setupTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.tab;
        this.switchTab(name);
      });
    });
  }

  switchTab(name) {
    this.activeTab = name;
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document
      .querySelectorAll(".panel")
      .forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));

    const saveBtn  = document.getElementById("saveHideBtn");
    const addBtn   = document.getElementById("addBtn");
    const bottomBar = document.querySelector(".bottom-bar");

    if (name === "hide") {
      bottomBar.style.display = "flex";
      saveBtn.style.display = "flex";
      addBtn.style.display = "none";
    } else if (name === "autoscroll") {
      // Everything auto-saves on this tab — hide the entire bottom bar so
      // the popup shrinks to fit just the controls.
      bottomBar.style.display = "none";
    } else {
      // Scripts tab: only the Add-script button
      bottomBar.style.display = "flex";
      saveBtn.style.display = "none";
      addBtn.style.display = "flex";
    }
  }

  /* ── BOTTOM BAR ── */
  setupBottomBar() {
    document.getElementById("addBtn").addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("options.html") + "?action=add",
      });
    });
    document
      .getElementById("saveHideBtn")
      .addEventListener("click", () => {
        if (this.activeTab === "hide") {
          this.saveHideSettings();
        }
        // autoscroll auto-saves; no Save button shown on that tab
      });
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.loadTab();
      this.toast("Refreshed ↻", "success");
    });
    document.getElementById("settingsBtn").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    });
  }

  /* ── LOAD CURRENT TAB ── */
  async loadTab() {
    this.send({ action: "getActiveTab" }, async (res) => {
      if (!res.tab) {
        document.getElementById("siteUrl").textContent = "Cannot access page";
        return;
      }
      this.currentTab = res.tab;
      this.updateSiteBar();
      await Promise.all([this.loadScripts(), this.loadHideSettings(), this.loadAutoScrollSettings()]);
    });
  }

  updateSiteBar() {
    const url = this.currentTab?.url;
    if (
      !url ||
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://")
    ) {
      document.getElementById("siteUrl").innerHTML = "<em>System page</em>";
      return;
    }
    try {
      const u = new URL(url);
      document.getElementById("siteUrl").innerHTML =
        `<strong>${u.hostname}</strong>${u.pathname !== "/" ? u.pathname.substring(0, 30) : ""}`;
    } catch {
      document.getElementById("siteUrl").textContent = url.substring(0, 50);
    }
  }

  /* ── SCRIPTS ── */
  async loadScripts() {
    this.send({ action: "getScripts" }, async (res) => {
      this.scripts = res.scripts || {};
      try {
        const { lastRun } = await chrome.storage.local.get("lastRun");
        this.lastRun = lastRun || {};
      } catch {
        this.lastRun = {};
      }
      this.renderScripts();
    });
  }

  renderScripts() {
    const list = document.getElementById("scriptsList");
    const searchWrap = document.getElementById("searchWrap");
    const url = this.currentTab?.url;

    if (!url || url.startsWith("chrome://")) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>Scripts cannot run on system pages.</p><div class="empty-sub">Open any regular website to use Injector here.</div></div>`;
      this.updateCount(0);
      if (searchWrap) searchWrap.style.display = "none";
      return;
    }

    const matching = Object.entries(this.scripts)
      .filter(([id, script]) => this.matchUrl(url, script.pattern))
      .map(([id, script]) => ({ id, ...script }));

    this.updateCount(matching.length);

    // Hide search bar when there are 0–1 scripts (no value to filter)
    if (searchWrap) {
      searchWrap.style.display = matching.length > 1 ? "flex" : "none";
    }

    if (matching.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>No scripts for this site yet.</p>
          <div class="empty-sub">Browse 25 ready-made templates, or use ＋ Add script below to write your own.</div>
          <div class="empty-actions">
            <button class="empty-cta primary" data-empty-action="browse">📋 Browse templates</button>
          </div>
        </div>`;
      list.querySelector('[data-empty-action="browse"]').addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") + "?tab=templates" });
      });
      return;
    }

    // Apply search filter
    const q = this.searchQuery;
    const visible = q
      ? matching.filter(
          (s) =>
            (s.name || "").toLowerCase().includes(q) ||
            (s.description || "").toLowerCase().includes(q),
        )
      : matching;

    if (visible.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No matches for "${this.esc(q)}".</p>
          <div class="empty-sub">Try a different keyword or clear the search.</div>
        </div>`;
      return;
    }

    list.innerHTML = "";
    visible.forEach((script, i) => {
      const card = this.buildCard(script, i);
      list.appendChild(card);
    });
  }

  /**
   * Human-readable relative time: "just now", "12s ago", "4m ago", "2h ago".
   * Returns null if timestamp is missing or older than 24h.
   */
  formatRelativeTime(ts) {
    if (!ts) return null;
    const diff = Date.now() - ts;
    if (diff < 0 || diff > 24 * 3600 * 1000) return null;
    if (diff < 10_000) return "just now";
    if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
    if (diff < 3600_000) return Math.floor(diff / 60_000) + "m ago";
    return Math.floor(diff / 3600_000) + "h ago";
  }

  updateCount(n) {
    document.getElementById("scriptBadge").textContent =
      `${n} script${n !== 1 ? "s" : ""}`;
    document.getElementById("tabCount").textContent = n;
  }

  buildCard(script, index) {
    const enabled = script.enabled !== false;
    const div = document.createElement("div");
    div.className = `script-card${enabled ? "" : " disabled"}`;
    div.style.animationDelay = `${index * 40}ms`;

    const run = this.lastRun[script.id];
    const rel = run ? this.formatRelativeTime(run.at) : null;
    let metaHtml = "";
    if (rel) {
      const cls = run.status === "error" ? "error" : "success";
      const sym = run.status === "error" ? "✗" : "✓";
      const label =
        run.status === "error"
          ? `errored ${rel}`
          : `ran ${rel}`;
      const errTip = run.error
        ? `<span class="script-meta-err" title="${this.esc(run.error)}">${this.esc(run.error)}</span>`
        : "";
      metaHtml = `<div class="script-meta ${cls}"><span class="script-meta-dot"></span><span>${sym} ${label}</span>${errTip}</div>`;
    }

    div.innerHTML = `
      <div class="script-card-top">
        <div class="script-status ${enabled ? "" : "off"}"></div>
        <div class="script-name">${this.esc(script.name)}</div>
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle" ${enabled ? "checked" : ""} title="Enable / disable">
        </div>
      </div>
      <div class="script-desc">${this.esc(script.description || "No description")}</div>
      ${metaHtml}
      <div class="script-actions">
        <button class="action-btn run" title="Run now">▶ Run</button>
        <button class="action-btn edit" title="Edit script">✏ Edit</button>
        <button class="action-btn del" title="Delete script">🗑 Delete</button>
      </div>
    `;

    const toggle = div.querySelector(".toggle");
    toggle.addEventListener("change", () =>
      this.toggleScript(script.id, toggle.checked, div),
    );

    div
      .querySelector(".run")
      .addEventListener("click", (e) =>
        this.runScript(script, e.currentTarget),
      );
    div.querySelector(".edit").addEventListener("click", () => {
      chrome.tabs.create({
        url:
          chrome.runtime.getURL("options.html") +
          "?edit=" +
          encodeURIComponent(script.id),
      });
    });
    div.querySelector(".del").addEventListener("click", () => {
      this.showDeleteDialog(script);
    });

    return div;
  }

  toggleScript(scriptId, enabled, cardEl) {
    cardEl.classList.toggle("disabled", !enabled);
    cardEl.querySelector(".script-status").classList.toggle("off", !enabled);
    this.send({ action: "toggleScript", scriptId: scriptId, enabled }, () => {
      this.toast(
        enabled ? "Script enabled ✓" : "Script disabled",
        enabled ? "success" : "",
      );
    });
  }

  showDeleteDialog(script) {
    // Create modal overlay
    const modal = document.createElement("div");
    modal.className = "injector-delete-modal";
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px);
      overflow: hidden;
    `;
    
    // Create dialog content
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      border: 1px solid rgba(124, 108, 248, 0.3); border-radius: 16px;
      padding: 24px; min-width: 320px; max-width: 340px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform, opacity;
      margin: 20px;
    `;

    // Add animation keyframes to document head
    if (!document.querySelector('#injector-dialog-animations')) {
      const style = document.createElement('style');
      style.id = 'injector-dialog-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    dialog.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 16px; font-size: 18px; text-align: center;">
        ⚠️️ Delete Script
      </div>
      <div style="margin-bottom: 20px; color: #a8a8b8; line-height: 1.5;">
        Are you sure you want to delete "<strong>${this.esc(script.name)}</strong>"?
        <br><br>
        This action cannot be undone.
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="cancel-delete" style="
          flex: 1; padding: 10px 16px; border: none; border-radius: 8px;
          background: rgba(255,255,255,0.1); color: #a8a8b8; cursor: pointer;
          font-size: 13px; font-weight: 600; transition: all 0.2s;
        ">Cancel</button>
        <button id="confirm-delete" style="
          flex: 1; padding: 10px 16px; border: none; border-radius: 8px;
          background: linear-gradient(135deg, #ff5a71 0%, #ff3838 100%);
          color: white; cursor: pointer; font-size: 13px; font-weight: 600;
          transition: all 0.2s;
        ">Delete</button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Force reflow to ensure proper positioning
    modal.offsetHeight;

    // Add event listeners
    const cancelBtn = dialog.querySelector("#cancel-delete");
    const confirmBtn = dialog.querySelector("#confirm-delete");

    cancelBtn.addEventListener("click", () => {
      this.hideDeleteDialog();
    });

    confirmBtn.addEventListener("click", () => {
      this.hideDeleteDialog();
      this.deleteScript(script);
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideDeleteDialog();
      }
    });

    // Add keyboard support
    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        this.hideDeleteDialog();
        document.removeEventListener("keydown", handleKeydown);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    
    // Store reference for cleanup
    modal._handleKeydown = handleKeydown;
  }

  hideDeleteDialog() {
    const modal = document.querySelector(".injector-delete-modal");
    if (modal) {
      if (modal._handleKeydown) {
        document.removeEventListener("keydown", modal._handleKeydown);
      }
      modal.remove();
    }
  }

  deleteScript(script) {
    chrome.storage.local.get("userScripts", (result) => {
      const all = result.userScripts || {};
      delete all[script.id];
      chrome.storage.local.set({ userScripts: all }, () => {
        this.toast(`"${script.name}" deleted`, "success");
        this.loadScripts();
      });
    });
  }

  runScript(script, btn) {
    if (!this.currentTab) return;
    btn.textContent = "⌛ Running…";
    btn.disabled = true;
    this.send(
      {
        action: "executeScriptInMainWorld",
        tabId: this.currentTab.id,
        code: script.code,
        scriptId: script.id,
      },
      (res) => {
        btn.disabled = false;
        if (res.error) {
          btn.textContent = "✗ Error";
          this.toast("Run failed: " + res.error, "error");
          setTimeout(() => {
            btn.textContent = "▶ Run";
          }, 2000);
        } else {
          btn.textContent = "✓ Done";
          btn.classList.add("run-success");
          this.toast(`"${script.name}" executed ✓`, "success");
          setTimeout(() => {
            btn.textContent = "▶ Run";
            btn.classList.remove("run-success");
          }, 2000);
        }
      },
    );
  }

  /* ── HIDE ELEMENTS ── */
  async loadHideSettings() {
    if (!this.currentTab?.url) return;
    try {
      const { hostname } = new URL(this.currentTab.url);
      this.send({ action: "getHiddenSettings", hostname }, (res) => {
        const s = res.settings || { enabled: false, selectors: "" };
        document.getElementById("hideToggle").checked = !!s.enabled;
        const input = document.getElementById("hideInput");
        input.value = s.selectors || "";
        // Trigger chip refresh (setupHideChips listens for input events)
        input.dispatchEvent(new Event("input"));
      });
    } catch {}
  }

  saveHideSettings() {
    if (!this.currentTab?.url) return;
    try {
      const { hostname } = new URL(this.currentTab.url);
      const enabled = document.getElementById("hideToggle").checked;
      const selectors = document.getElementById("hideInput").value.trim();
      this.send(
        {
          action: "saveHiddenSettings",
          hostname,
          settings: { enabled, selectors },
        },
        (res) => {
          if (res.success) {
            this.toast("Saved! Applying changes…", "success");
            // Send message to content script to apply immediately
            chrome.tabs.sendMessage(this.currentTab.id, {
              action: "applyHiddenSettings",
              settings: { enabled, selectors }
            });
          }
        },
      );
    } catch {}
  }

  /* ── AUTO-SCROLL ── */
  async loadAutoScrollSettings() {
    if (!this.currentTab?.url) return;
    try {
      const { hostname } = new URL(this.currentTab.url);
      this.send({ action: "getAutoScrollSettings", hostname }, (res) => {
        const s = Object.assign(
          { enabled: false, mode: "smooth", dir: "down", speed: 120, stepPx: 200 },
          res.settings || {},
        );
        this._asState = { ...s };

        document.getElementById("autoScrollToggle").checked = !!s.enabled;

        document.querySelectorAll(".as-mode-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.mode === s.mode);
        });
        document.querySelectorAll(".as-dir-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.dir === s.dir);
        });

        const slider = document.getElementById("asSpeedSlider");
        const speedValue = document.getElementById("asSpeedValue");
        if (slider) slider.value = s.speed;
        if (speedValue) speedValue.textContent = s.speed;
        // Repaint track fill after programmatic value set (input event doesn't fire)
        if (this._paintSpeedTrack) this._paintSpeedTrack();
      });
    } catch {}
  }

  /* ── URL MATCHING ── */
  matchUrl(url, pattern) {
    try {
      if (!pattern) return false;
      if (pattern === "*") return true;
      if (pattern.includes("*")) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp("^" + escaped.replace(/\\\*/g, ".*") + "$").test(url);
      }
      return url.includes(pattern);
    } catch {
      return false;
    }
  }

  /* ── HELPERS ── */
  send(msg, cb) {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError)
        console.warn(chrome.runtime.lastError.message);
      cb(res || {});
    });
  }

  esc(t) {
    const d = document.createElement("div");
    d.textContent = String(t ?? "");
    return d.innerHTML;
  }

  toast(msg, type = "", duration = 2200) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = `toast show${type ? " " + type : ""}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), duration);
  }
}

/* ── auto-refresh when storage changes ── */
chrome.storage.local.onChanged.addListener(() => {
  if (window._pm) window._pm.loadScripts();
});

/* ── boot ── */
window._pm  = new PopupManager();

/* Update button text based on active tab */
function updateButtonText() {
  const saveBtn = document.getElementById("saveHideBtn");
  if (window._pm && saveBtn) {
    if (window._pm.activeTab === "autoscroll") {
      saveBtn.innerHTML = "💾 Save";
    } else if (window._pm.activeTab === "hide") {
      saveBtn.innerHTML = "💾 Save";
    }
  }
}

/* Update button text when tab switches */
const originalSwitchTab = PopupManager.prototype.switchTab;
PopupManager.prototype.switchTab = function(name) {
  originalSwitchTab.call(this, name);
  updateButtonText();
};
