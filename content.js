/**
 * ScriptRunner - Content script for the Web Customizer Chrome extension
 *
 * This class is responsible for:
 * - Loading and managing user scripts from storage
 * - Executing scripts on matching web pages
 * - Handling DOM changes for dynamic content
 * - URL pattern matching for script targeting
 * - Script execution in the main world context (bypassing CSP)
 *
 * Runs automatically on page load and monitors for script updates.
 */
class ScriptRunner {
    /**
     * Constructor - Initialize the script runner and load user scripts
     * Sets up the scripts object and triggers initial script loading
     */
    constructor() {
        this.scripts = {};
        this.executedScripts = new Set(); // Track executed scripts to prevent duplicates
        this.pendingExecutions = new Map(); // Debounce timers for each script
        this.setupBridge();
        this.loadScripts();
        this.loadHiddenSettings();
    }

    /**
     * Setup a bridge to allow scripts in the Main World to communicate with the extension
     */
    setupBridge() {
        window.addEventListener('web-customizer-send-telegram', (event) => {
            if (event.detail) {
                chrome.runtime.sendMessage({
                    action: 'sendTelegram',
                    ...event.detail
                }, (response) => {
                    // Optional: send response back via another event if needed
                });
            }
        });
    }

    /**
     * Load user scripts from Chrome storage via background script
     * Retrieves all scripts and triggers execution for current page
     */
    async loadScripts() {
        try {
            chrome.runtime.sendMessage(
                { action: 'getScripts' },
                (response) => {
                    if (!chrome.runtime.lastError && response && response.scripts) {
                        this.scripts = response.scripts;
                        console.log('📜 Scripts loaded:', Object.keys(this.scripts).length);
                        this.runScripts();
                    } else {
                        console.warn('Failed to load scripts:', chrome.runtime.lastError);
                    }
                }
            );
        } catch (error) {
            console.warn('Failed to load scripts:', error);
        }
    }

    /**
     * Execute scripts that match the current page URL
     * Uses smart execution strategy to prevent duplicate runs:
     * - Executes once when DOM is ready
     * - Re-executes only on significant DOM changes (debounced)
     */
    runScripts() {
        const currentUrl = window.location.href;

        Object.entries(this.scripts).forEach(([pattern, script]) => {
            if (script.enabled !== false && this.urlMatchesPattern(currentUrl, pattern)) {
                const scriptKey = `${pattern}:${currentUrl}`;

                // Execute script with smart timing
                this.scheduleExecution(scriptKey, script.code, pattern, script.name);
            }
        });
    }

    /**
     * Schedule script execution with debounce to prevent duplicates
     * @param {string} scriptKey - Unique key for this script+URL combination
     * @param {string} code - JavaScript code to execute
     * @param {string} pattern - URL pattern
     * @param {string} name - Script name
     */
    scheduleExecution(scriptKey, code, pattern, name) {
        // Clear any pending execution for this script
        if (this.pendingExecutions.has(scriptKey)) {
            clearTimeout(this.pendingExecutions.get(scriptKey));
        }

        // If already executed and DOM is complete, don't re-execute immediately
        if (this.executedScripts.has(scriptKey) && document.readyState === 'complete') {
            return;
        }

        const execute = () => {
            if (!this.executedScripts.has(scriptKey)) {
                this.executedScripts.add(scriptKey);
                this.executeScript(code, pattern, name);
            }
        };

        // Execute based on document state
        if (document.readyState === 'complete') {
            execute();
        } else if (document.readyState === 'interactive') {
            // DOM is ready but resources still loading
            execute();
        } else {
            // Wait for DOMContentLoaded
            const timer = setTimeout(() => {
                if (document.readyState !== 'loading') {
                    execute();
                } else {
                    document.addEventListener('DOMContentLoaded', execute, { once: true });
                }
            }, 100);
            this.pendingExecutions.set(scriptKey, timer);
        }

        // Setup observer for dynamic content (with debounce)
        this.observeDOM(() => {
            // Allow re-execution after significant DOM changes
            // but only if enough time has passed
            const rerunKey = `${scriptKey}:rerun`;
            if (!this.pendingExecutions.has(rerunKey)) {
                this.executedScripts.delete(scriptKey); // Allow re-execution
                this.executeScript(code, pattern, name);
                this.executedScripts.add(scriptKey);

                // Prevent rapid re-executions
                const cooldown = setTimeout(() => {
                    this.pendingExecutions.delete(rerunKey);
                }, 5000); // 5 second cooldown between re-runs
                this.pendingExecutions.set(rerunKey, cooldown);
            }
        });
    }

    /**
     * Monitor DOM changes and re-execute scripts for dynamic content
     * Useful for single-page applications and sites with lazy loading
     *
     * @param {Function} callback - Function to execute when DOM changes
     * @param {number} delay - Debounce delay in milliseconds (default: 2000)
     */
    observeDOM(callback, delay = 2000) {
        // Wait for document.body to be available
        if (!document.body) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.observeDOM(callback, delay));
            }
            return;
        }

        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(callback, delay);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    /**
     * Check if current URL matches a script's URL pattern
     * Supports wildcard patterns for flexible domain matching
     *
     * @param {string} url - Current page URL
     * @param {string} pattern - Script URL pattern to match against
     * @returns {boolean} True if URL matches the pattern
     */
    urlMatchesPattern(url, pattern) {
        try {
            if (!pattern) return false;
            if (pattern === '*') return true;

            // Handle wildcard patterns
            if (pattern.includes('*')) {
                // 1. Escape special regex characters INCLUDING *
                // We escape * so we can consistently target it for replacement
                const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // 2. Convert escaped asterisk (\*) to regex wildcard (.*)
                const regexString = '^' + escaped.replace(/\\\*/g, '.*') + '$';

                const regex = new RegExp(regexString);
                return regex.test(url);
            }

            // Fallback for exact substring match (legacy behavior)
            return url.includes(pattern);
        } catch (error) {
            console.warn('URL matching error for pattern:', pattern, error);
            return false;
        }
    }

    /**
     * Execute user script in main world context via background script
     * Bypasses Content Security Policy restrictions by using chrome.runtime messaging
     *
     * @param {string} code - JavaScript code to execute
     * @param {string} pattern - URL pattern that triggered this execution
     * @param {string} name - Script name for logging purposes
     */
    executeScript(code, pattern, name) {
        chrome.runtime.sendMessage(
            {
                action: 'executeScriptInMainWorld',
                code: code,
                scriptId: name
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error(`❌ Script failed for ${pattern}:`, chrome.runtime.lastError.message);
                } else if (response && response.error) {
                    console.error(`❌ Script failed for ${pattern}:`, response.error);
                } else {
                    console.log(`✅ Script executed: ${name}`);
                }
            }
        );
    }

    /**
     * Load hidden element settings for the current page
     */
    async loadHiddenSettings() {
        try {
            chrome.runtime.sendMessage(
                { action: 'getHiddenSettings', hostname: window.location.hostname },
                (response) => {
                    if (response && response.settings) {
                        this.applyHiddenStyles(response.settings);
                    }
                }
            );
        } catch (error) {
            console.warn('Failed to load hidden settings:', error);
        }
    }

    /**
     * Apply hidden element styles based on settings
     * @param {Object} settings - { enabled, selectors }
     */
    applyHiddenStyles(settings) {
        const styleId = 'web-customizer-hidden-styles';
        let styleEl = document.getElementById(styleId);

        if (!settings.enabled || !settings.selectors) {
            if (styleEl) styleEl.remove();
            return;
        }

        const selectors = settings.selectors.split(',').map(s => {
            s = s.trim();
            if (!s) return null;
            // If already a selector (starts with . or # or [), use it
            if (s.startsWith('.') || s.startsWith('#') || s.startsWith('[')) return s;

            // Assume it's a class or list of classes
            // Split by space to handle "class1 class2" -> ".class1.class2"
            return '.' + s.split(/\s+/).join('.');
        }).filter(Boolean).join(', ');

        if (!selectors) {
            if (styleEl) styleEl.remove();
            return;
        }

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        styleEl.textContent = `${selectors} { display: none !important; }`;
        console.log('🚫 Hidden elements applied:', selectors);
    }
}

/**
 * Initialize Script Runner instance
 * Creates a global scriptRunner that loads and executes user scripts
 */
const scriptRunner = new ScriptRunner();

/**
 * Listen for Chrome storage changes to reload scripts
 * Automatically updates scripts when user makes changes in popup
 * Resets execution tracking to allow re-execution of updated scripts
 *
 * @param {Object} changes - Storage changes object
 * @param {string} namespace - Storage namespace (should be 'local')
 */
chrome.storage.local.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.userScripts) {
            scriptRunner.scripts = changes.userScripts.newValue || {};
            // Reset execution tracking to allow updated scripts to run
            scriptRunner.executedScripts.clear();
            scriptRunner.pendingExecutions.forEach(timer => clearTimeout(timer));
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
