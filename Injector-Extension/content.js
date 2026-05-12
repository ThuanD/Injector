/**
 * ScriptRunner - Content script for the Injector Chrome extension
 * Combines script auto-execution with auto-scroll functionality
 */
class ScriptRunner {
  constructor() {
    this.scripts = {};
    this.executedScripts = new Set();
    this.pendingExecutions = new Map();
    this.lastUrl = location.href;
    this.autoScroller = null;
    // Persistent auto-scroll settings — survives settings-popup open/close and
    // is used as the source of truth for Start, mode switches, and slider edits.
    this.autoScrollSettings = {
      dir: "down",
      mode: "smooth",
      speed: 120,
      stepPx: 200,
    };
    this.setupBridge();
    this.loadScripts();
    this.loadHiddenSettings();
    this.loadAutoScrollSettings();
    this.watchSPANavigation();
    this.setupMessageListener();
  }

  setupBridge() {
    window.addEventListener("web-customizer-send-telegram", (event) => {
      if (event.detail) {
        chrome.runtime.sendMessage({
          action: "sendTelegram",
          ...event.detail,
        });
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case "executeScriptInMainWorld":
          this.executeUserScript(message.code, message.scriptId);
          sendResponse({ success: true });
          break;

        case "asStart":
          this.startAutoScroll(message);
          sendResponse({ ok: true });
          break;

        case "asStop":
          this.stopAutoScroll();
          sendResponse({ ok: true });
          break;

        case "asUpdate":
          this.updateAutoScroll(message);
          sendResponse({ ok: true });
          break;

        case "asQuery":
          sendResponse({ running: this.autoScroller !== null });
          break;

        case "asProgress":
          sendResponse({ pct: this.autoScroller ? this.autoScroller.getProgress() : 0 });
          break;

        case "getAutoScrollSettings":
          this.getAutoScrollSettings(message.hostname, sendResponse);
          break;

        case "saveAutoScrollSettings":
          this.saveAutoScrollSettings(message.hostname, message.settings, sendResponse);
          break;
        case "applyAutoScrollSettings":
          this.applyAutoScrollSettings(message.settings);
          sendResponse({ success: true });
          break;
        case "applyHiddenSettings":
          this.applyHiddenStyles(message.settings);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: "Unknown action" });
      }
    });
  }

  async loadScripts() {
    try {
      chrome.runtime.sendMessage({ action: "getScripts" }, (response) => {
        if (!chrome.runtime.lastError && response && response.scripts) {
          this.scripts = response.scripts;
          console.log("Injector: Scripts loaded:", Object.keys(this.scripts).length);
          this.runScripts();
        }
      });
    } catch (error) {
      console.warn("Failed to load scripts:", error);
    }
  }

  runScripts() {
    const currentUrl = window.location.href;

    Object.entries(this.scripts).forEach(([id, script]) => {
      // Use script.pattern instead of key
      const pattern = script.pattern || id; // fallback for old scripts (legacy)

      if (
        script.enabled !== false &&
        this.urlMatchesPattern(currentUrl, pattern)
      ) {
        const scriptKey = `${id}::${currentUrl}`;

        if (!this.executedScripts.has(scriptKey)) {
          this.scheduleExecution(scriptKey, script.code, pattern, script.name, id);
        }
      }
    });
  }

  scheduleExecution(scriptKey, code, pattern, name, id) {
    if (this.executedScripts.has(scriptKey)) return;

    // Clear pending if any
    if (this.pendingExecutions.has(scriptKey)) {
      clearTimeout(this.pendingExecutions.get(scriptKey));
      this.pendingExecutions.delete(scriptKey);
    }

    const execute = () => {
      if (this.executedScripts.has(scriptKey)) return; // guard double-run
      this.executedScripts.add(scriptKey);
      this.executeScript(code, pattern, name, id);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", execute, { once: true });
    } else {
      // Small delay to ensure dynamic content has rendered
      const timer = setTimeout(execute, 300);
      this.pendingExecutions.set(scriptKey, timer);
    }
  }

  /**
   * Monitor SPA navigation (URL changes without page reload)
   * Only re-run scripts when URL actually changes
   */
  watchSPANavigation() {
    // Patch pushState / replaceState
    const patchHistory = (method) => {
      const original = history[method];
      history[method] = (...args) => {
        original.apply(history, args);
        this.onUrlChange();
      };
    };
    patchHistory("pushState");
    patchHistory("replaceState");

    // popstate (back/forward)
    window.addEventListener("popstate", () => this.onUrlChange());
  }

  onUrlChange() {
    const newUrl = location.href;
    if (newUrl === this.lastUrl) return;
    this.lastUrl = newUrl;

    // Clear executed set to let scripts run again on new page
    this.executedScripts.clear();
    this.pendingExecutions.forEach((t) => clearTimeout(t));
    this.pendingExecutions.clear();

    // Small delay for SPA to finish rendering content
    setTimeout(() => this.runScripts(), 500);
  }

  urlMatchesPattern(url, pattern) {
    try {
      if (!pattern) return false;
      if (pattern === "*") return true;
      if (pattern.includes("*")) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regexString = "^" + escaped.replace(/\\\*/g, ".*") + "$";
        return new RegExp(regexString).test(url);
      }
      return url.includes(pattern);
    } catch (error) {
      console.warn("URL matching error:", pattern, error);
      return false;
    }
  }

  executeScript(code, pattern, name, id) {
    chrome.runtime.sendMessage(
      { action: "executeScriptInMainWorld", code, scriptId: id || name },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Injector: Script failed for ${pattern}:`,
            chrome.runtime.lastError.message,
          );
        } else if (response && response.error) {
          console.error(`Injector: Script failed for ${pattern}:`, response.error);
        } else {
          console.log(`Injector: Script executed: ${name}`);
        }
      },
    );
  }

  executeUserScript(code, scriptId) {
    try {
      // Create isolated function to avoid polluting global scope
      const scriptFunction = new Function(code);
      scriptFunction();
      console.log(`Injector: User script executed: ${scriptId}`);
    } catch (error) {
      console.error(`Injector: Error executing script ${scriptId}:`, error);
    }
  }

  async loadHiddenSettings() {
    try {
      chrome.runtime.sendMessage(
        { action: "getHiddenSettings", hostname: window.location.hostname },
        (response) => {
          if (response && response.settings) {
            this.applyHiddenStyles(response.settings);
          }
        },
      );
    } catch (error) {
      console.warn("Failed to load hidden settings:", error);
    }
  }

  applyHiddenStyles(settings) {
    const styleId = "web-customizer-hidden-styles";
    let styleEl = document.getElementById(styleId);

    if (!settings.enabled || !settings.selectors) {
      if (styleEl) styleEl.remove();
      return;
    }

    const selectors = settings.selectors
      .split(",")
      .map((s) => {
        s = s.trim();
        return s || null;
      })
      .filter(Boolean)
      .join(", ");

    if (!selectors) {
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `${selectors} { display: none !important; }`;
    console.log("Injector: Hidden elements applied:", selectors);
  }

  async loadAutoScrollSettings() {
    try {
      chrome.runtime.sendMessage(
        { action: "getAutoScrollSettings", hostname: window.location.hostname },
        (response) => {
          if (response && response.settings) {
            this.applyAutoScrollSettings(response.settings);
          }
        },
      );
    } catch (error) {
      console.warn("Failed to load auto scroll settings:", error);
    }
  }

  getAutoScrollSettings(hostname, callback) {
    chrome.storage.local.get("autoScrollSettings", (result) => {
      const settings = result.autoScrollSettings || {};
      const siteSettings = settings[hostname] || { enabled: false };
      callback({ settings: siteSettings });
    });
  }

  saveAutoScrollSettings(hostname, settings, callback) {
    chrome.storage.local.get("autoScrollSettings", (result) => {
      const allSettings = result.autoScrollSettings || {};
      allSettings[hostname] = settings;
      chrome.storage.local.set({ autoScrollSettings: allSettings }, () => {
        callback({ success: true });
        // Apply settings immediately
        this.applyAutoScrollSettings(settings);
      });
    });
  }

  /**
   * React to a fresh auto-scroll settings payload from the popup. Accepts a
   * full settings object — { enabled, mode, dir, speed, stepPx } — and:
   *
   *   - merges non-enabled fields into this.autoScrollSettings (used as
   *     defaults for next start)
   *   - propagates live changes into a running scroller via update() so a
   *     mode/dir/speed change in the popup applies without user toggling off+on
   *   - on enable=true: shows on-page controls AND auto-starts the scroller
   *     so the user doesn't have to click the on-page ▶ as a second step
   *   - on enable=false: stops + hides controls
   */
  applyAutoScrollSettings(settings) {
    if (!settings) return;

    // Merge persisted fields (skip enabled — that one drives start/stop below)
    ["mode", "dir", "speed", "stepPx"].forEach((k) => {
      if (settings[k] !== undefined) this.autoScrollSettings[k] = settings[k];
    });

    if (settings.enabled) {
      // Ensure floating controls are present
      if (!document.getElementById("injector-autoscroll-controls")) {
        this.showAutoScrollControls();
      }
      // Start or update the actual scroller
      if (this.autoScroller) {
        this.autoScroller.update({ ...this.autoScrollSettings });
      } else {
        this.startAutoScroll({ ...this.autoScrollSettings });
        // Sync the on-page ▶/⏸ button visual to "running" state (danger color)
        const btn = document.getElementById("injector-autoscroll-startstop");
        if (btn) {
          btn.innerHTML = `<span style="font-size: 18px;">⏸</span>`;
          btn.title = "Pause Auto-Scroll";
          btn.style.background = "linear-gradient(135deg, #ff5a71 0%, #e74860 100%)";
          btn.style.boxShadow = "0 4px 15px rgba(255, 90, 113, 0.4)";
        }
      }
    } else {
      this.stopAutoScroll();
      this.hideAutoScrollControls();
    }
  }

  showAutoScrollControls() {
    // Remove existing controls
    this.hideAutoScrollControls();

    // Create controls container
    const controls = document.createElement("div");
    controls.id = "injector-autoscroll-controls";
    controls.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      display: flex; flex-direction: row; gap: 10px;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Brand-aligned styles (match the extension popup palette)
    const RUN_BG = "linear-gradient(135deg, #3dd6f5 0%, #7c6cf8 100%)"; // accent → accent2
    const RUN_SHADOW = "0 4px 15px rgba(61, 214, 245, 0.35)";
    const STOP_BG = "linear-gradient(135deg, #ff5a71 0%, #e74860 100%)"; // danger
    const STOP_SHADOW = "0 4px 15px rgba(255, 90, 113, 0.4)";
    const GHOST_BG = "rgba(12, 14, 20, 0.9)"; // bg with slight transparency
    const GHOST_BORDER = "rgba(61, 214, 245, 0.3)";
    const GHOST_SHADOW = "0 4px 15px rgba(0, 0, 0, 0.35)";

    // Start/Stop button — primary action (brand gradient when idle, danger when running)
    const startStopBtn = document.createElement("button");
    startStopBtn.id = "injector-autoscroll-startstop";
    const running = !!this.autoScroller;
    startStopBtn.style.cssText = `
      background: ${running ? STOP_BG : RUN_BG};
      border: none; border-radius: 50%;
      color: #080a10; padding: 0; cursor: pointer;
      font-weight: 700; width: 42px; height: 42px;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s, background 0.25s;
      box-shadow: ${running ? STOP_SHADOW : RUN_SHADOW};
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    `;
    startStopBtn.innerHTML = `<span style="font-size: 16px;">${running ? '⏸' : '▶'}</span>`;
    startStopBtn.title = running ? "Pause Auto-Scroll" : "Start Auto-Scroll";
    startStopBtn.addEventListener("click", () => this.toggleAutoScroll());

    // Settings button — secondary (ghost) so it doesn't compete with the
    // primary action. Same size as Play to feel balanced; the visual
    // weight difference comes from filled vs ghost, not from dimensions.
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "injector-autoscroll-settings";
    settingsBtn.style.cssText = `
      background: ${GHOST_BG};
      border: 1px solid ${GHOST_BORDER}; border-radius: 50%;
      color: #3dd6f5; padding: 0; cursor: pointer;
      font-weight: 600; width: 42px; height: 42px;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s, border-color 0.25s;
      box-shadow: ${GHOST_SHADOW};
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
      backdrop-filter: blur(8px);
    `;
    settingsBtn.innerHTML = `<span style="font-size: 16px;">⚙</span>`;
    settingsBtn.title = "Auto-Scroll Settings";
    settingsBtn.addEventListener("click", () => this.showSettingsPopup());

    // Add ripple effect
    const createRipple = (btn, e) => {
      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute; border-radius: 50%; background: rgba(255,255,255,0.3);
        width: ${size}px; height: ${size}px; left: ${x}px; top: ${y}px;
        transform: scale(0); animation: ripple 0.6s linear;
        pointer-events: none;
      `;
      
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };

    // Hover/press feedback — shadow color tracks the button's current state
    const shadowFor = (btn, hover) => {
      if (btn === settingsBtn) {
        return hover ? "0 8px 25px rgba(0, 0, 0, 0.5)" : GHOST_SHADOW;
      }
      const isRunning = this.autoScroller !== null;
      if (isRunning) {
        return hover ? "0 8px 25px rgba(255, 90, 113, 0.55)" : STOP_SHADOW;
      }
      return hover ? "0 8px 25px rgba(61, 214, 245, 0.5)" : RUN_SHADOW;
    };

    [startStopBtn, settingsBtn].forEach(btn => {
      btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateY(-2px) scale(1.04)";
        btn.style.boxShadow = shadowFor(btn, true);
        if (btn === settingsBtn) btn.style.borderColor = "rgba(61, 214, 245, 0.55)";
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "translateY(0) scale(1)";
        btn.style.boxShadow = shadowFor(btn, false);
        if (btn === settingsBtn) btn.style.borderColor = GHOST_BORDER;
      });

      btn.addEventListener("mousedown", (e) => {
        btn.style.transform = "translateY(0) scale(0.97)";
        createRipple(btn, e);
      });

      btn.addEventListener("mouseup", () => {
        btn.style.transform = "translateY(-2px) scale(1.04)";
      });
    });

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      #injector-autoscroll-controls {
        animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #injector-autoscroll-controls button::before {
        content: '';
        position: absolute;
        top: 0; left: -100%;
        width: 100%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s;
      }
      
      #injector-autoscroll-controls button:hover::before {
        left: 100%;
      }
    `;
    document.head.appendChild(style);

    controls.appendChild(startStopBtn);
    controls.appendChild(settingsBtn);
    document.body.appendChild(controls);

    console.log("Injector: Auto-scroll controls added");
  }

  hideAutoScrollControls() {
    const controls = document.getElementById("injector-autoscroll-controls");
    if (controls) {
      controls.remove();
      console.log("Injector: Auto-scroll controls removed");
    }
    this.hideSettingsPopup();
  }

  toggleAutoScroll() {
    const btn = document.getElementById("injector-autoscroll-startstop");
    if (!btn) return;
    if (this.autoScroller) {
      // Stop → return to idle/brand state
      this.stopAutoScroll();
      btn.innerHTML = `<span style="font-size: 18px;">▶</span>`;
      btn.title = "Start Auto-Scroll";
      btn.style.background = "linear-gradient(135deg, #3dd6f5 0%, #7c6cf8 100%)";
      btn.style.boxShadow = "0 4px 15px rgba(61, 214, 245, 0.35)";
    } else {
      // Start → switch to danger/running state
      this.startAutoScroll({ ...this.autoScrollSettings });
      btn.innerHTML = `<span style="font-size: 18px;">⏸</span>`;
      btn.title = "Pause Auto-Scroll";
      btn.style.background = "linear-gradient(135deg, #ff5a71 0%, #e74860 100%)";
      btn.style.boxShadow = "0 4px 15px rgba(255, 90, 113, 0.4)";
    }
  }

  showSettingsPopup() {
    // Remove existing popup
    this.hideSettingsPopup();

    // Create popup — matches the extension popup's dark surface and brand accents
    const popup = document.createElement("div");
    popup.id = "injector-autoscroll-settings-popup";
    popup.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 1000000;
      background: #0c0e14;
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;
      padding: 16px; min-width: 280px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 60px rgba(61, 214, 245, 0.06);
      color: #dce3f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(12px);
    `;

    popup.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 14px; font-size: 14px; text-align: center; color: #dce3f0; letter-spacing: -0.01em;">
        Auto-Scroll Settings
      </div>

      <div style="margin-bottom: 14px;">
        <div style="font-size: 10px; margin-bottom: 6px; color: #6b7794; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Direction</div>
        <div style="display: flex; gap: 6px;">
          <button data-dir="down" class="dir-btn" style="flex: 1; padding: 7px; border: 1px solid rgba(124, 108, 248, 0.45); background: rgba(124, 108, 248, 0.08); color: #7c6cf8; cursor: pointer; font-size: 11.5px; font-weight: 600; border-radius: 7px; transition: all 0.18s;">↓ Down</button>
          <button data-dir="up" class="dir-btn" style="flex: 1; padding: 7px; border: 1px solid rgba(255,255,255,0.07); background: transparent; color: #dce3f0; cursor: pointer; font-size: 11.5px; font-weight: 600; border-radius: 7px; transition: all 0.18s;">↑ Up</button>
        </div>
      </div>

      <div style="margin-bottom: 14px;">
        <div style="font-size: 10px; margin-bottom: 6px; color: #6b7794; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Mode</div>
        <div style="display: flex; gap: 5px;">
          <button data-mode="smooth" class="mode-btn" style="flex: 1; padding: 7px; border: 1px solid rgba(245, 166, 35, 0.45); background: rgba(245, 166, 35, 0.08); color: #f5a623; cursor: pointer; font-size: 11.5px; font-weight: 600; border-radius: 7px; transition: all 0.18s;">Smooth</button>
          <button data-mode="step" class="mode-btn" style="flex: 1; padding: 7px; border: 1px solid rgba(255,255,255,0.07); background: transparent; color: #dce3f0; cursor: pointer; font-size: 11.5px; font-weight: 600; border-radius: 7px; transition: all 0.18s;">Step</button>
          <button data-mode="loop" class="mode-btn" style="flex: 1; padding: 7px; border: 1px solid rgba(255,255,255,0.07); background: transparent; color: #dce3f0; cursor: pointer; font-size: 11.5px; font-weight: 600; border-radius: 7px; transition: all 0.18s;">Loop</button>
        </div>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 10px; color: #6b7794; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Speed</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #f5a623; font-weight: 700;"><span id="speed-value">120</span> px/s</span>
        </div>
        <input type="range" id="speed-slider" min="10" max="800" value="120" style="width: 100%; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; outline: none; -webkit-appearance: none;">
      </div>

      <div id="step-row" style="margin-bottom: 14px; transition: opacity 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 10px; color: #6b7794; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Step Size <span id="step-hint" style="text-transform: none; letter-spacing: 0; color: #4e5870; font-weight: 500;"></span></span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #7c6cf8; font-weight: 700;"><span id="step-value">200</span> px</span>
        </div>
        <input type="range" id="step-slider" min="50" max="1000" value="200" style="width: 100%; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; outline: none; -webkit-appearance: none;">
      </div>

      <button id="close-settings" style="width: 100%; padding: 8px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.07); color: #dce3f0; cursor: pointer; font-size: 12px; font-weight: 600; border-radius: 7px; transition: all 0.18s;">Close</button>
    `;

    document.body.appendChild(popup);

    // Source of truth — persisted across popup open/close and reads back from
    // the live AutoScroller if one is running.
    const settings = this.autoScrollSettings;
    if (this.autoScroller) {
      settings.dir = this.autoScroller.dir;
      settings.mode = this.autoScroller.mode;
      settings.speed = this.autoScroller.speed;
      settings.stepPx = this.autoScroller.stepPx;
    }

    // Style palettes — match the popup's "quiet" active treatment:
    // subtle bg tint + colored border + colored text (not full gradient fill).
    const DIR_ACTIVE = {
      background: "rgba(124, 108, 248, 0.08)",
      borderColor: "rgba(124, 108, 248, 0.45)",
      color: "#7c6cf8",
    };
    const MODE_ACTIVE = {
      background: "rgba(245, 166, 35, 0.08)",
      borderColor: "rgba(245, 166, 35, 0.45)",
      color: "#f5a623",
    };
    const INACTIVE = {
      background: "transparent",
      borderColor: "rgba(255, 255, 255, 0.07)",
      color: "#dce3f0",
    };
    const applyStyle = (el, s) => {
      el.style.background = s.background;
      el.style.borderColor = s.borderColor;
      el.style.color = s.color;
    };
    const syncGroup = (sel, attr, value, activeStyle) => {
      popup.querySelectorAll(sel).forEach((b) => {
        applyStyle(b, b.dataset[attr] === value ? activeStyle : INACTIVE);
      });
    };

    // Step Size only applies in Step mode (setInterval + nudge by stepPx).
    // In Smooth/Loop it's ignored, so we visually disable the row to make
    // that obvious and prevent the user from "tweaking" something that
    // does nothing.
    const stepRow = popup.querySelector("#step-row");
    const stepSliderEl = popup.querySelector("#step-slider");
    const stepHint = popup.querySelector("#step-hint");
    const syncStepEnabled = (mode) => {
      const active = mode === "step";
      if (stepRow) stepRow.style.opacity = active ? "1" : "0.4";
      if (stepSliderEl) {
        stepSliderEl.disabled = !active;
        stepSliderEl.style.cursor = active ? "pointer" : "not-allowed";
      }
      if (stepHint) stepHint.textContent = active ? "" : "(Step mode only)";
    };

    // Initial visual sync from persisted settings (overrides hardcoded
    // Smooth+Down active styling in the template above)
    syncGroup(".dir-btn", "dir", settings.dir, DIR_ACTIVE);
    syncGroup(".mode-btn", "mode", settings.mode, MODE_ACTIVE);
    syncStepEnabled(settings.mode);

    // Direction — both Smooth and Step read this.dir each tick, so a
    // property mutation is enough (no restart needed).
    popup.querySelectorAll(".dir-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.dir = btn.dataset.dir;
        syncGroup(".dir-btn", "dir", settings.dir, DIR_ACTIVE);
        if (this.autoScroller) {
          this.autoScroller.dir = settings.dir;
        }
      });
    });

    // Mode switch — Smooth uses requestAnimationFrame while Step uses
    // setInterval. Property mutation alone leaves the old timer running, so
    // we MUST go through update() which stops the old loop and starts the
    // new one. This was the bug where clicking Step/Loop appeared to do
    // nothing.
    popup.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.mode = btn.dataset.mode;
        syncGroup(".mode-btn", "mode", settings.mode, MODE_ACTIVE);
        syncStepEnabled(settings.mode);
        if (this.autoScroller) {
          this.autoScroller.update({ mode: settings.mode });
        }
      });
    });

    // Webkit range inputs don't paint a filled portion before the thumb —
    // emulate via linear-gradient bg. `fillColor` differs per slider so each
    // slider's track matches its thumb.
    const paintTrack = (input, fillColor) => {
      const min = +input.min || 0;
      const max = +input.max || 100;
      const pct = ((+input.value - min) / (max - min)) * 100;
      const idle = "rgba(255, 255, 255, 0.06)";
      input.style.background = `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${pct}%, ${idle} ${pct}%, ${idle} 100%)`;
    };

    const speedSlider = popup.querySelector("#speed-slider");
    const speedValue = popup.querySelector("#speed-value");
    speedSlider.value = settings.speed;
    speedValue.textContent = settings.speed;
    paintTrack(speedSlider, "#f5a623");
    speedSlider.addEventListener("input", () => {
      settings.speed = parseInt(speedSlider.value);
      speedValue.textContent = settings.speed;
      paintTrack(speedSlider, "#f5a623");
      if (this.autoScroller) {
        this.autoScroller.speed = settings.speed;
      }
    });

    const stepSlider = popup.querySelector("#step-slider");
    const stepValue = popup.querySelector("#step-value");
    stepSlider.value = settings.stepPx;
    stepValue.textContent = settings.stepPx;
    paintTrack(stepSlider, "#7c6cf8");
    stepSlider.addEventListener("input", () => {
      settings.stepPx = parseInt(stepSlider.value);
      stepValue.textContent = settings.stepPx;
      paintTrack(stepSlider, "#7c6cf8");
      if (this.autoScroller) {
        this.autoScroller.stepPx = settings.stepPx;
      }
    });

    // Add slider styling
    const style = document.createElement('style');
    style.textContent = `
      #injector-autoscroll-settings-popup input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: #f5a623;
        cursor: pointer;
        border-radius: 50%;
        box-shadow: 0 0 8px rgba(245, 166, 35, 0.5);
        transition: box-shadow 0.18s, transform 0.18s;
      }
      #injector-autoscroll-settings-popup input[type="range"]::-webkit-slider-thumb:hover {
        box-shadow: 0 0 12px rgba(245, 166, 35, 0.8);
        transform: scale(1.1);
      }
      #injector-autoscroll-settings-popup input[type="range"]::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #f5a623;
        cursor: pointer;
        border-radius: 50%;
        border: none;
        box-shadow: 0 0 8px rgba(245, 166, 35, 0.5);
      }
      #injector-autoscroll-settings-popup #step-slider::-webkit-slider-thumb {
        background: #7c6cf8;
        box-shadow: 0 0 8px rgba(124, 108, 248, 0.5);
      }
      #injector-autoscroll-settings-popup #step-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 0 12px rgba(124, 108, 248, 0.8);
      }
      #injector-autoscroll-settings-popup #step-slider::-moz-range-thumb {
        background: #7c6cf8;
        box-shadow: 0 0 8px rgba(124, 108, 248, 0.5);
      }
      #injector-autoscroll-settings-popup #close-settings:hover {
        border-color: rgba(61, 214, 245, 0.4);
        color: #3dd6f5;
        background: rgba(61, 214, 245, 0.05);
      }
    `;
    document.head.appendChild(style);

    popup.querySelector("#close-settings").addEventListener("click", () => {
      this.hideSettingsPopup();
    });

    // Close popup when clicking outside
    const closeHandler = (e) => {
      if (!popup.contains(e.target)) {
        this.hideSettingsPopup();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 100);
  }

  hideSettingsPopup() {
    const popup = document.getElementById("injector-autoscroll-settings-popup");
    if (popup) {
      popup.remove();
    }
  }

  // ==================== AUTO-SCROLL FUNCTIONALITY ====================
  
  startAutoScroll(options) {
    this.stopAutoScroll(); // Stop any existing scroller
    this.autoScroller = new AutoScroller(options);
    console.log("Injector: Auto-scroll started");
  }

  stopAutoScroll() {
    if (this.autoScroller) {
      this.autoScroller.stop();
      this.autoScroller = null;
      console.log("Injector: Auto-scroll stopped");
    }
  }

  updateAutoScroll(options) {
    if (this.autoScroller) {
      this.autoScroller.update(options);
      console.log("Injector: Auto-scroll updated");
    }
  }
}

// ==================== AUTO-SCROLLER CLASS ====================

class AutoScroller {
  constructor(options) {
    this.dir = options.dir || "down";
    this.mode = options.mode || "smooth";
    this.speed = options.speed || 120;
    this.stepPx = options.stepPx || 200;
    this.running = true;
    this.lastTime = Date.now();
    this.stepInterval = null;
    this.animationFrame = null;

    this.start();
  }

  start() {
    this.running = true; // Ensure running state is set
    if (this.mode === "smooth") {
      this.startSmooth();
    } else if (this.mode === "step") {
      this.startStep();
    } else if (this.mode === "loop") {
      this.startLoop();
    }
  }

  startSmooth() {
    // Wait for page to be ready
    if (document.readyState !== 'complete') {
      setTimeout(() => this.startSmooth(), 500);
      return;
    }
    
    // Debug page dimensions
    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = pageHeight - viewportHeight;
    
    
    if (maxScroll <= 0) {
      return;
    }
    
    // Add visual indicator
    this.addScrollIndicator();

    const scroll = () => {
      if (!this.running) return;

      const now = Date.now();
      const delta = (now - this.lastTime) / 1000;
      this.lastTime = now;

      const scrollAmount = this.speed * delta;
      
      // Use multiple scroll position methods for better compatibility
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const currentMaxScroll = document.documentElement.scrollHeight - window.innerHeight;

      let newScroll =
        this.dir === "down"
          ? currentScroll + scrollAmount
          : currentScroll - scrollAmount;

      // Handle boundaries
      if (this.dir === "down" && newScroll >= currentMaxScroll) {
        newScroll = this.mode === "loop" ? 0 : currentMaxScroll;
      } else if (this.dir === "up" && newScroll <= 0) {
        newScroll = this.mode === "loop" ? currentMaxScroll : 0;
      }

      // Debug logging
      if (Math.random() < 0.02) { // Log 2% of time to avoid spam
      }

      window.scrollTo(0, newScroll);
      this.animationFrame = requestAnimationFrame(scroll);
    };

    this.animationFrame = requestAnimationFrame(scroll);
  }

  startStep() {
    this.stepInterval = setInterval(() => {
      if (!this.running) return;

      const currentScroll = window.pageYOffset;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      let newScroll =
        this.dir === "down"
          ? currentScroll + this.stepPx
          : currentScroll - this.stepPx;

      // Handle boundaries
      if (this.dir === "down" && newScroll >= maxScroll) {
        newScroll = this.mode === "loop" ? 0 : maxScroll;
      } else if (this.dir === "up" && newScroll <= 0) {
        newScroll = this.mode === "loop" ? maxScroll : 0;
      }

      window.scrollTo(0, newScroll);
    }, 1000);
  }

  startLoop() {
    this.startSmooth(); // Loop uses smooth scrolling with boundary handling
  }

  update(options) {
    // Update properties immediately
    this.dir = options.dir || this.dir;
    this.mode = options.mode || this.mode;
    this.speed = options.speed || this.speed;
    this.stepPx = options.stepPx || this.stepPx;

    // If already running, restart immediately with new settings
    if (this.running) {
      const wasRunning = true;
      this.stop();
      // Use micro-delay to ensure proper cleanup
      setTimeout(() => {
        this.start();
        console.log("Injector: Auto-scroll updated and restarted");
      }, 10);
    } else {
      // If not running, just update the settings for next start
      console.log("Injector: Auto-scroll settings updated");
    }
  }

  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    
    // Remove visual indicator
    const indicator = document.getElementById('injector-autoscroll-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  getProgress() {
    const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    return maxScroll > 0 ? Math.round((currentScroll / maxScroll) * 100) : 0;
  }

  addScrollIndicator() {
    // Remove existing indicators
    const existing = document.getElementById('injector-autoscroll-indicator');
    if (existing) existing.remove();
    
    const existingMouse = document.getElementById('injector-mouse-indicator');
    if (existingMouse) existingMouse.remove();

    // Create floating scroll indicator
    const indicator = document.createElement('div');
    indicator.id = 'injector-autoscroll-indicator';
    indicator.style.cssText = `
      position: fixed; top: 50%; right: 20px; z-index: 999999;
      transform: translateY(-50%);
      background: rgba(12, 14, 20, 0.92); border: 1px solid rgba(61, 214, 245, 0.4); border-radius: 50%;
      width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
      color: #3dd6f5; font-size: 15px; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(61, 214, 245, 0.15);
      backdrop-filter: blur(8px);
      transition: all 0.25s ease;
    `;
    indicator.innerHTML = this.dir === 'down' ? '↓' : '↑';
    indicator.title = 'Auto-scrolling (' + this.mode + ')';
    
    // Create mouse position indicator (center screen)
    const mouseIndicator = document.createElement('div');
    mouseIndicator.id = 'injector-mouse-indicator';
    mouseIndicator.style.cssText = `
      position: fixed; top: 50%; left: 50%; z-index: 999998;
      transform: translate(-50%, -50%);
      width: 20px; height: 20px; border: 2px solid #ff5a71; border-radius: 50%;
      background: rgba(255, 90, 113, 0.1); pointer-events: none;
      animation: pulse 2s infinite;
    `;
    mouseIndicator.innerHTML = '';
    mouseIndicator.title = 'Scroll center point';
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(indicator);
    document.body.appendChild(mouseIndicator);
  }

  }

// ==================== INITIALIZATION ====================

const scriptRunner = new ScriptRunner();

// Reload scripts when user changes in options page
chrome.storage.local.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    if (changes.userScripts) {
      scriptRunner.scripts = changes.userScripts.newValue || {};
      // Clear and re-run with new scripts
      scriptRunner.executedScripts.clear();
      scriptRunner.pendingExecutions.forEach((t) => clearTimeout(t));
      scriptRunner.pendingExecutions.clear();
      scriptRunner.runScripts();
    }

    if (changes.hiddenSettings) {
      const newSettings = changes.hiddenSettings.newValue || {};
      const hostSettings = newSettings[window.location.hostname];
      if (hostSettings) {
        scriptRunner.applyHiddenStyles(hostSettings);
      }
    }

    if (changes.autoScrollSettings) {
      const newSettings = changes.autoScrollSettings.newValue || {};
      const hostSettings = newSettings[window.location.hostname];
      if (hostSettings) {
        scriptRunner.applyAutoScrollSettings(hostSettings);
      }
    }
  }
});
