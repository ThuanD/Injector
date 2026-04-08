class PopupManager {
  constructor() {
    this.scripts = {};
    this.currentTab = null;
    this.activeTab = "scripts";
    this.init();
  }

  async init() {
    this.setupTabs();
    this.setupBottomBar();
    await this.loadTab();
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
    const manageBtn = document.getElementById("manageBtn");

    if (name === "hide") {
      // Hide tab: only show saveHideBtn
      saveBtn.style.display = "flex";
      addBtn.style.display = "none";
      manageBtn.style.display = "none";
    } else if (name === "autoscroll") {
      // AutoScroll tab: only show saveHideBtn
      saveBtn.style.display = "flex";
      addBtn.style.display = "none";
      manageBtn.style.display = "none";
    } else {
      // Scripts tab: keep current state (show all buttons)
      saveBtn.style.display = "none";
      addBtn.style.display = "flex";
      manageBtn.style.display = "flex";
      manageBtn.style.flex = "";
    }
  }

  /* ── BOTTOM BAR ── */
  setupBottomBar() {
    document.getElementById("manageBtn").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    });
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
        } else if (this.activeTab === "autoscroll") {
          this.saveAutoScrollSettings();
        }
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
    this.send({ action: "getScripts" }, (res) => {
      this.scripts = res.scripts || {};
      this.renderScripts();
    });
  }

  renderScripts() {
    const list = document.getElementById("scriptsList");
    const url = this.currentTab?.url;

    if (!url || url.startsWith("chrome://")) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>Scripts cannot run on system pages.</p></div>`;
      this.updateCount(0);
      return;
    }

    const matching = Object.entries(this.scripts)
      .filter(([id, script]) => this.matchUrl(url, script.pattern))
      .map(([id, script]) => ({ id, ...script }));

    this.updateCount(matching.length);

    if (matching.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>No scripts for this site.</p>
          <div class="empty-hint">Click "+ Add" to create one →</div>
        </div>`;
      return;
    }

    list.innerHTML = "";
    matching.forEach((script, i) => {
      const card = this.buildCard(script, i);
      list.appendChild(card);
    });
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

    div.innerHTML = `
      <div class="script-card-top">
        <div class="script-status ${enabled ? "" : "off"}"></div>
        <div class="script-name">${this.esc(script.name)}</div>
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle" ${enabled ? "checked" : ""} title="Enable / disable">
        </div>
      </div>
      <div class="script-desc">${this.esc(script.description || "No description")}</div>
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
      if (!confirm(`Delete "${script.name}"?`)) return;
      chrome.storage.local.get("userScripts", (result) => {
        const all = result.userScripts || {};
        delete all[script.id];
        chrome.storage.local.set({ userScripts: all }, () => {
          this.toast(`"${script.name}" deleted`, "");
          this.loadScripts();
        });
      });
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
        document.getElementById("hideInput").value = s.selectors || "";
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
            this.toast("Saved! Reloading page…", "success");
            setTimeout(() => chrome.tabs.reload(this.currentTab.id), 700);
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
        const s = res.settings || { enabled: false };
        document.getElementById("autoScrollToggle").checked = !!s.enabled;
      });
    } catch {}
  }

  saveAutoScrollSettings() {
    if (!this.currentTab?.url) return;
    try {
      const { hostname } = new URL(this.currentTab.url);
      const enabled = document.getElementById("autoScrollToggle").checked;
      this.send(
        {
          action: "saveAutoScrollSettings",
          hostname,
          settings: { enabled },
        },
        (res) => {
          if (res.success) {
            this.toast("Saved! Reloading page…", "success");
            setTimeout(() => chrome.tabs.reload(this.currentTab.id), 700);
          }
        },
      );
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
      saveBtn.innerHTML = " Save & Reload";
    } else if (window._pm.activeTab === "hide") {
      saveBtn.innerHTML = " Save & Reload";
    }
  }
}

/* Update button text when tab switches */
const originalSwitchTab = PopupManager.prototype.switchTab;
PopupManager.prototype.switchTab = function(name) {
  originalSwitchTab.call(this, name);
  updateButtonText();
};
