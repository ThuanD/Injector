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
      console.log('[AutoScroll] Visual indicator removed');
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
    indicator.title = 'Auto-scrolling (' + this.mode + ') - Click to stop';
    
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
    
    // Click to stop
    indicator.addEventListener('click', () => {
      this.stop();
      indicator.remove();
      mouseIndicator.remove();
    });
    
    document.body.appendChild(indicator);
    document.body.appendChild(mouseIndicator);
    console.log('[AutoScroll] Visual indicators added');
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
  }
});
