/**
 * ScriptRunner - Content script for the Injector Chrome extension
 */
class ScriptRunner {
  constructor() {
    this.scripts = {};
    this.executedScripts = new Set();
    this.pendingExecutions = new Map();
    this.lastUrl = location.href;
    this.setupBridge();
    this.loadScripts();
    this.loadHiddenSettings();
    this.watchSPANavigation();
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

  async loadScripts() {
    try {
      chrome.runtime.sendMessage({ action: "getScripts" }, (response) => {
        if (!chrome.runtime.lastError && response && response.scripts) {
          this.scripts = response.scripts;
          console.log("📜 Scripts loaded:", Object.keys(this.scripts).length);
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
   * Only re-run scripts when URL actually changes — DO NOT re-run when DOM changes
   * caused by the script itself (this is the cause of double execution)
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
            `❌ Script failed for ${pattern}:`,
            chrome.runtime.lastError.message,
          );
        } else if (response && response.error) {
          console.error(`❌ Script failed for ${pattern}:`, response.error);
        } else {
          console.log(`✅ Script executed: ${name}`);
        }
      },
    );
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
    console.log("🚫 Hidden elements applied:", selectors);
  }
}

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
