/**
 * ScriptRunner - Content script for the Web Customizer Chrome extension
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

    Object.entries(this.scripts).forEach(([pattern, script]) => {
      if (
        script.enabled !== false &&
        this.urlMatchesPattern(currentUrl, pattern)
      ) {
        // Key theo cả URL để SPA navigation trigger đúng
        const scriptKey = `${pattern}::${currentUrl}`;

        if (!this.executedScripts.has(scriptKey)) {
          this.scheduleExecution(scriptKey, script.code, pattern, script.name);
        }
      }
    });
  }

  scheduleExecution(scriptKey, code, pattern, name) {
    if (this.executedScripts.has(scriptKey)) return;

    // Clear pending nếu có
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
      // Nhỏ delay để đảm bảo dynamic content đã render
      const timer = setTimeout(execute, 300);
      this.pendingExecutions.set(scriptKey, timer);
    }
  }

  /**
   * Theo dõi SPA navigation (URL thay đổi mà không reload trang)
   * Chỉ re-run scripts khi URL thực sự thay đổi — KHÔNG re-run khi DOM thay đổi
   * do chính script gây ra (đây là nguyên nhân chạy 2 lần)
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

    // Clear executed set để scripts chạy lại ở trang mới
    this.executedScripts.clear();
    this.pendingExecutions.forEach((t) => clearTimeout(t));
    this.pendingExecutions.clear();

    // Delay nhỏ để SPA render xong content
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

// Reload scripts khi user thay đổi trong options page
chrome.storage.local.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    if (changes.userScripts) {
      scriptRunner.scripts = changes.userScripts.newValue || {};
      // Clear và re-run với scripts mới
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
