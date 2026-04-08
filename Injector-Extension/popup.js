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
      // Scroll tab: no buttons needed
      saveBtn.style.display = "none";
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
      .addEventListener("click", () => this.saveHideSettings());
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
      await Promise.all([this.loadScripts(), this.loadHideSettings()]);
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

/* ════════════════════════════════════════════════
   AUTO-SCROLL MANAGER
   Injects a self-contained scroller into the active
   tab via chrome.scripting / messaging.
════════════════════════════════════════════════ */
class AutoScrollManager {
  constructor(popupManager) {
    this.pm       = popupManager;
    this.running  = false;
    this.dir      = "down";   // "down" | "up"
    this.mode     = "smooth"; // "smooth" | "step" | "loop"
    this.speed    = 120;      // px / second
    this.stepPx   = 200;      // px per step tick

    this._progressInterval = null;

    this._bindUI();
    this._restoreState();
  }

  /* ── bind all UI elements ── */
  _bindUI() {
    /* start/stop */
    document.getElementById("asToggleBtn")
      .addEventListener("click", () => this.toggle());

    /* speed slider */
    const speedSlider = document.getElementById("asSpeed");
    const speedVal    = document.getElementById("asSpeedVal");
    speedSlider.addEventListener("input", () => {
      this.speed = +speedSlider.value;
      speedVal.textContent = this.speed;
      if (this.running) this._sendUpdate();
    });

    /* step slider */
    const stepSlider = document.getElementById("asStep");
    const stepVal    = document.getElementById("asStepVal");
    stepSlider.addEventListener("input", () => {
      this.stepPx = +stepSlider.value;
      stepVal.textContent = this.stepPx;
      if (this.running) this._sendUpdate();
    });

    /* direction buttons */
    document.querySelectorAll(".as-dir-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".as-dir-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.dir = btn.dataset.dir;
        if (this.running) this._sendUpdate();
      });
    });

    /* mode buttons */
    document.querySelectorAll(".as-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".as-mode-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.mode = btn.dataset.mode;
        if (this.running) this._sendUpdate();
      });
    });
  }

  /* ── restore persisted state from storage ── */
  _restoreState() {
    chrome.storage.local.get("autoScrollState", (result) => {
      const s = result.autoScrollState;
      if (!s) return;

      if (s.speed !== undefined) {
        this.speed = s.speed;
        document.getElementById("asSpeed").value  = s.speed;
        document.getElementById("asSpeedVal").textContent = s.speed;
      }
      if (s.stepPx !== undefined) {
        this.stepPx = s.stepPx;
        document.getElementById("asStep").value   = s.stepPx;
        document.getElementById("asStepVal").textContent = s.stepPx;
      }
      if (s.dir) {
        this.dir = s.dir;
        document.querySelectorAll(".as-dir-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.dir === s.dir);
        });
      }
      if (s.mode) {
        this.mode = s.mode;
        document.querySelectorAll(".as-mode-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.mode === s.mode);
        });
      }

      /* check if scroll is actually running in the tab */
      if (s.running && this.pm.currentTab) {
        this._queryRunning();
      }
    });
  }

  /* ask content script whether scroll is active */
  _queryRunning() {
    if (!this.pm.currentTab) return;
    chrome.tabs.sendMessage(
      this.pm.currentTab.id,
      { action: "asQuery" },
      (res) => {
        if (chrome.runtime.lastError) return;
        if (res && res.running) {
          this.running = true;
          this._setUI(true);
        }
      },
    );
  }

  /* ── toggle start/stop ── */
  toggle() {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    if (!this.pm.currentTab) {
      this.pm.toast("No active tab", "error");
      return;
    }
    const url = this.pm.currentTab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      this.pm.toast("Cannot scroll system pages", "error");
      return;
    }

    this._sendStart();
  }

  stop() {
    if (!this.pm.currentTab) return;
    chrome.tabs.sendMessage(
      this.pm.currentTab.id,
      { action: "asStop" },
      () => { if (chrome.runtime.lastError) {} },
    );
    this.running = false;
    this._setUI(false);
    this._saveState();
    this.pm.toast("Auto-scroll stopped ■", "");
  }

  /* ── send start command directly to content.js ── */
  _sendStart() {
    const tabId = this.pm.currentTab.id;
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "asStart",
        dir:    this.dir,
        mode:   this.mode,
        speed:  this.speed,
        stepPx: this.stepPx,
      },
      (res) => {
        if (chrome.runtime.lastError) {
          this.pm.toast("Error: " + chrome.runtime.lastError.message, "error");
          return;
        }
        if (!res?.ok) {
          this.pm.toast("Could not start scroll", "error");
          return;
        }
        this.running = true;
        this._setUI(true);
        this._saveState();
        this.pm.toast("Auto-scroll started ▶", "success");
        this._startProgressPoll();
      },
    );
  }

  _sendUpdate() {
    if (!this.pm.currentTab) return;
    chrome.tabs.sendMessage(
      this.pm.currentTab.id,
      {
        action: "asUpdate",
        dir:    this.dir,
        mode:   this.mode,
        speed:  this.speed,
        stepPx: this.stepPx,
      },
      () => { if (chrome.runtime.lastError) {} },
    );
    this._saveState();
  }

  /* ── update UI to reflect running state ── */
  _setUI(isRunning) {
    const btn   = document.getElementById("asToggleBtn");
    const icon  = document.getElementById("asToggleIcon");
    const label = document.getElementById("asToggleLabel");
    const dot   = document.getElementById("asStatusDot");
    const txt   = document.getElementById("asStatusText");
    const wrap  = document.getElementById("asProgressWrap");

    if (isRunning) {
      btn.classList.add("running");
      icon.textContent  = "■";
      label.textContent = "Stop Auto-Scroll";
      dot.classList.add("active");
      txt.innerHTML = `<strong>Running</strong> · ${this.mode} · ${this.dir} · ${this.speed} px/s`;
      wrap.classList.add("visible");
    } else {
      btn.classList.remove("running");
      icon.textContent  = "▶";
      label.textContent = "Start Auto-Scroll";
      dot.classList.remove("active");
      txt.innerHTML = "Idle — press Start to begin";
      wrap.classList.remove("visible");
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
  }

  /* ── poll scroll progress via content script ── */
  _startProgressPoll() {
    clearInterval(this._progressInterval);
    this._progressInterval = setInterval(() => {
      if (!this.running || !this.pm.currentTab) return;
      chrome.tabs.sendMessage(
        this.pm.currentTab.id,
        { action: "asProgress" },
        (res) => {
          if (chrome.runtime.lastError || !res) return;
          const pct = res.pct ?? 0;
          document.getElementById("asProgressBar").style.width = pct + "%";
          document.getElementById("asStatusText").innerHTML =
            `<strong>Running</strong> · ${this.mode} · ${this.dir} · ${this.speed} px/s · <strong>${pct}%</strong>`;
        },
      );
    }, 500);
  }

  /* ── persist settings to storage ── */
  _saveState() {
    chrome.storage.local.set({
      autoScrollState: {
        running: this.running,
        dir:     this.dir,
        mode:    this.mode,
        speed:   this.speed,
        stepPx:  this.stepPx,
      },
    });
  }
}

/* ── auto-refresh when storage changes ── */
chrome.storage.local.onChanged.addListener(() => {
  if (window._pm) window._pm.loadScripts();
});

/* ── boot ── */
window._pm  = new PopupManager();

/* Wait for PM to finish loading tab, then init AutoScroll */
(function waitForTab() {
  if (window._pm.currentTab !== null || document.readyState === "complete") {
    window._as = new AutoScrollManager(window._pm);
  } else {
    setTimeout(waitForTab, 80);
  }
})();
