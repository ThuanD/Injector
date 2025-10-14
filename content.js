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
        this.loadScripts();
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
     * Implements multiple execution strategies for reliability:
     * - Immediate execution for fast-loading pages
     * - Retry on window load for late-loading elements
     * - DOM observation for dynamically loaded content
     */
    runScripts() {
        const currentUrl = window.location.href;

        Object.entries(this.scripts).forEach(([pattern, script]) => {
            if (script.enabled !== false && this.urlMatchesPattern(currentUrl, pattern)) {
                // Try immediately
                this.executeScript(script.code, pattern, script.name);

                // Retry after DOM fully loads
                if (document.readyState !== 'complete') {
                    window.addEventListener('load', () => {
                        this.executeScript(script.code, pattern, script.name);
                    });
                }

                // Also try with MutationObserver for lazy-loaded content
                this.observeDOM(() => {
                    this.executeScript(script.code, pattern, script.name);
                });
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
        if (pattern === '*') return true;

        if (pattern.startsWith('*.')) {
            const domain = pattern.slice(2);
            return url.includes(domain);
        }

        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\//g, '.*') + '$');
            return regex.test(url);
        }

        return url.includes(pattern);
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
}

/**
 * Initialize Script Runner instance
 * Creates a global scriptRunner that loads and executes user scripts
 */
const scriptRunner = new ScriptRunner();

/**
 * Listen for Chrome storage changes to reload scripts
 * Automatically updates scripts when user makes changes in popup
 *
 * @param {Object} changes - Storage changes object
 * @param {string} namespace - Storage namespace (should be 'local')
 */
chrome.storage.local.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.userScripts) {
        scriptRunner.scripts = changes.userScripts.newValue || {};
        scriptRunner.runScripts();
    }
});
