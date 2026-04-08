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
          this.scheduleExecution(scriptKey, script.code, pattern, script.name);
        }
      }
    });
  }

  scheduleExecution(scriptKey, code, pattern, name) {
    if (this.executedScripts.has(scriptKey)) return;

    // Clear pending if any
    if (this.pendingExecutions.has(scriptKey)) {
      clearTimeout(this.pendingExecutions.get(scriptKey));
      this.pendingExecutions.delete(scriptKey);
    }

    const execute = () => {
      if (this.executedScripts.has(scriptKey)) return; // guard double-run
      this.executedScripts.add(scriptKey);
      this.executeScript(code, pattern, name);
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

  executeScript(code, pattern, name) {
    chrome.runtime.sendMessage(
      { action: "executeScriptInMainWorld", code, scriptId: name },
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
        if (!s) return null;
        if (s.startsWith(".") || s.startsWith("#") || s.startsWith("["))
          return s;
        return "." + s.split(/\s+/).join(".");
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

  applyAutoScrollSettings(settings) {
    if (settings.enabled) {
      this.showAutoScrollControls();
    } else {
      this.hideAutoScrollControls();
      this.stopAutoScroll();
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

    // Start/Stop button
    const startStopBtn = document.createElement("button");
    startStopBtn.id = "injector-autoscroll-startstop";
    startStopBtn.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none; border-radius: 50%;
      color: white; padding: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; width: 48px; height: 48px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    `;
    startStopBtn.innerHTML = `
      <span style="font-size: 18px;">${this.autoScroller ? '⏸' : '▶'}</span>
    `;
    startStopBtn.title = this.autoScroller ? "Pause Auto-Scroll" : "Start Auto-Scroll";
    startStopBtn.addEventListener("click", () => this.toggleAutoScroll());

    // Settings button
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "injector-autoscroll-settings";
    settingsBtn.style.cssText = `
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border: none; border-radius: 50%;
      color: white; padding: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; width: 48px; height: 48px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    `;
    settingsBtn.innerHTML = `
      <span style="font-size: 18px;">⚙</span>
    `;
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

    // Add enhanced hover effects and ripple
    [startStopBtn, settingsBtn].forEach(btn => {
      btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateY(-3px) scale(1.05)";
        btn.style.boxShadow = btn === startStopBtn 
          ? "0 8px 25px rgba(102, 126, 234, 0.6)"
          : "0 8px 25px rgba(240, 147, 251, 0.6)";
      });
      
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "translateY(0) scale(1)";
        btn.style.boxShadow = btn === startStopBtn 
          ? "0 4px 15px rgba(102, 126, 234, 0.4)"
          : "0 4px 15px rgba(240, 147, 251, 0.4)";
      });

      btn.addEventListener("mousedown", (e) => {
        btn.style.transform = "translateY(-1px) scale(0.98)";
        createRipple(btn, e);
      });
      
      btn.addEventListener("mouseup", () => {
        btn.style.transform = "translateY(-3px) scale(1.05)";
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
    if (this.autoScroller) {
      this.stopAutoScroll();
      // Update button to Start state
      btn.innerHTML = `
        <span style="font-size: 18px;">▶</span>
      `;
      btn.title = "Start Auto-Scroll";
      btn.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      btn.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
    } else {
      this.startAutoScroll({
        dir: "down",
        mode: "smooth",
        speed: 120,
        stepPx: 200
      });
      // Update button to Pause state
      btn.innerHTML = `
        <span style="font-size: 18px;">⏸</span>
      `;
      btn.title = "Pause Auto-Scroll";
      btn.style.background = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
      btn.style.boxShadow = "0 4px 15px rgba(240, 147, 251, 0.4)";
    }
  }

  showSettingsPopup() {
    // Remove existing popup
    this.hideSettingsPopup();

    // Create popup
    const popup = document.createElement("div");
    popup.id = "injector-autoscroll-settings-popup";
    popup.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 1000000;
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      border: 1px solid rgba(124, 108, 248, 0.3); border-radius: 16px;
      padding: 20px; min-width: 280px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(10px);
    `;

    popup.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 16px; font-size: 16px; text-align: center; color: #fff;">
        Auto-Scroll Settings
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; margin-bottom: 6px; color: #a8a8b8; font-weight: 500;">Direction</div>
        <div style="display: flex; gap: 8px;">
          <button data-dir="down" class="dir-btn" style="flex: 1; padding: 8px; border: 2px solid #7c6cf8; background: linear-gradient(135deg, #7c6cf8, #6b5bc7); color: white; cursor: pointer; font-size: 12px; font-weight: 600; border-radius: 8px; transition: all 0.2s;">Down</button>
          <button data-dir="up" class="dir-btn" style="flex: 1; padding: 8px; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #a8a8b8; cursor: pointer; font-size: 12px; font-weight: 600; border-radius: 8px; transition: all 0.2s;">Up</button>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; margin-bottom: 6px; color: #a8a8b8; font-weight: 500;">Mode</div>
        <div style="display: flex; gap: 6px;">
          <button data-mode="smooth" class="mode-btn" style="flex: 1; padding: 6px; border: 2px solid #f5a623; background: linear-gradient(135deg, #f5a623, #e09512); color: white; cursor: pointer; font-size: 11px; font-weight: 600; border-radius: 6px; transition: all 0.2s;">Smooth</button>
          <button data-mode="step" class="mode-btn" style="flex: 1; padding: 6px; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #a8a8b8; cursor: pointer; font-size: 11px; font-weight: 600; border-radius: 6px; transition: all 0.2s;">Step</button>
          <button data-mode="loop" class="mode-btn" style="flex: 1; padding: 6px; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #a8a8b8; cursor: pointer; font-size: 11px; font-weight: 600; border-radius: 6px; transition: all 0.2s;">Loop</button>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; margin-bottom: 6px; color: #a8a8b8; font-weight: 500;">Speed: <span id="speed-value" style="color: #7c6cf8; font-weight: 700;">120</span> px/s</div>
        <input type="range" id="speed-slider" min="10" max="800" value="120" style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; -webkit-appearance: none;">
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; margin-bottom: 6px; color: #a8a8b8; font-weight: 500;">Step: <span id="step-value" style="color: #f5a623; font-weight: 700;">200</span> px</div>
        <input type="range" id="step-slider" min="50" max="1000" value="200" style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; -webkit-appearance: none;">
      </div>
      
      <button id="close-settings" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; cursor: pointer; font-size: 13px; font-weight: 600; border-radius: 8px; transition: all 0.2s;">Close</button>
    `;

    document.body.appendChild(popup);

    // Store current settings
    const currentSettings = {
      dir: this.autoScroller ? this.autoScroller.dir : "down",
      mode: this.autoScroller ? this.autoScroller.mode : "smooth",
      speed: this.autoScroller ? this.autoScroller.speed : 120,
      stepPx: this.autoScroller ? this.autoScroller.stepPx : 200
    };

    // Setup event listeners
    popup.querySelectorAll(".dir-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        popup.querySelectorAll(".dir-btn").forEach(b => {
          b.style.background = "rgba(255,255,255,0.05)";
          b.style.borderColor = "rgba(255,255,255,0.1)";
          b.style.color = "#a8a8b8";
        });
        btn.style.background = "linear-gradient(135deg, #7c6cf8, #6b5bc7)";
        btn.style.borderColor = "#7c6cf8";
        btn.style.color = "white";
        currentSettings.dir = btn.dataset.dir;
        if (this.autoScroller) {
          this.autoScroller.dir = currentSettings.dir;
        }
      });
      
      btn.addEventListener("mouseenter", () => {
        if (btn.style.background === "rgba(255,255,255,0.05)" || btn.style.background.includes("0.05")) {
          btn.style.background = "rgba(255,255,255,0.1)";
          btn.style.borderColor = "rgba(255,255,255,0.2)";
        }
      });
      
      btn.addEventListener("mouseleave", () => {
        if (btn.style.background === "rgba(255,255,255,0.1)" || btn.style.background.includes("0.1")) {
          btn.style.background = "rgba(255,255,255,0.05)";
          btn.style.borderColor = "rgba(255,255,255,0.1)";
        }
      });
    });

    popup.querySelectorAll(".mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        popup.querySelectorAll(".mode-btn").forEach(b => {
          b.style.background = "rgba(255,255,255,0.05)";
          b.style.borderColor = "rgba(255,255,255,0.1)";
          b.style.color = "#a8a8b8";
        });
        btn.style.background = "linear-gradient(135deg, #f5a623, #e09512)";
        btn.style.borderColor = "#f5a623";
        btn.style.color = "white";
        currentSettings.mode = btn.dataset.mode;
        if (this.autoScroller) {
          this.autoScroller.mode = currentSettings.mode;
        }
      });
      
      btn.addEventListener("mouseenter", () => {
        if (btn.style.background === "rgba(255,255,255,0.05)" || btn.style.background.includes("0.05")) {
          btn.style.background = "rgba(255,255,255,0.1)";
          btn.style.borderColor = "rgba(255,255,255,0.2)";
        }
      });
      
      btn.addEventListener("mouseleave", () => {
        if (btn.style.background === "rgba(255,255,255,0.1)" || btn.style.background.includes("0.1")) {
          btn.style.background = "rgba(255,255,255,0.05)";
          btn.style.borderColor = "rgba(255,255,255,0.1)";
        }
      });
    });

    const speedSlider = popup.querySelector("#speed-slider");
    const speedValue = popup.querySelector("#speed-value");
    speedSlider.addEventListener("input", () => {
      currentSettings.speed = parseInt(speedSlider.value);
      speedValue.textContent = currentSettings.speed;
      if (this.autoScroller) {
        this.autoScroller.speed = currentSettings.speed;
      }
    });

    const stepSlider = popup.querySelector("#step-slider");
    const stepValue = popup.querySelector("#step-value");
    stepSlider.addEventListener("input", () => {
      currentSettings.stepPx = parseInt(stepSlider.value);
      stepValue.textContent = currentSettings.stepPx;
      if (this.autoScroller) {
        this.autoScroller.stepPx = currentSettings.stepPx;
      }
    });

    // Add slider styling
    const style = document.createElement('style');
    style.textContent = `
      #injector-autoscroll-settings-popup input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: linear-gradient(135deg, #7c6cf8, #6b5bc7);
        cursor: pointer;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(124, 108, 248, 0.5);
      }
      
      #injector-autoscroll-settings-popup input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: linear-gradient(135deg, #7c6cf8, #6b5bc7);
        cursor: pointer;
        border-radius: 50%;
        border: none;
        box-shadow: 0 2px 8px rgba(124, 108, 248, 0.5);
      }
      
      #injector-autoscroll-settings-popup #close-settings:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
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
      background: #1a1a1a; border: 2px solid #3dd6f5; border-radius: 50%;
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      color: white; font-size: 16px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
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
