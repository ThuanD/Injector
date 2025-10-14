/**
 * PopupManager - Chrome extension popup interface manager
 *
 * This class manages the popup UI that appears when users click the extension icon.
 * It handles:
 * - Displaying current site information
 * - Loading and filtering scripts for the current tab
 * - Script execution and toggling
 * - URL pattern matching for script targeting
 * - Real-time updates when scripts change
 *
 * Provides an intuitive interface for users to manage scripts for the current website.
 */
class PopupManager {
    /**
     * Constructor - Initialize popup manager and start core functionality
     * Sets up initial state and triggers essential setup methods
     */
    constructor() {
        this.scripts = {};
        this.currentTab = null;
        this.init();
    }

    /**
     * Initialize popup functionality
     * Coordinates initial setup of tab detection, event listeners, and auto-refresh
     */
    init() {
        this.getCurrentTab();
        this.setupEventListeners();
        this.setupRefresh();
    }

    /**
     * Get information about the currently active tab
     * Retrieves tab data from background script for site detection
     */
    async getCurrentTab() {
        this.sendMessage({ action: 'getActiveTab' }, (response) => {
            if (response.tab) {
                this.currentTab = response.tab;
                this.updateCurrentSite();
                this.loadScripts();
            }
        });
    }

    /**
     * Update the displayed current site information
     * Shows hostname and port of the active tab's URL
     */
    updateCurrentSite() {
        const el = document.getElementById('currentSite');
        if (this.currentTab?.url) {
            const url = new URL(this.currentTab.url);
            el.textContent = `${url.hostname}${url.port ? ':' + url.port : ''}`;
        } else {
            el.textContent = 'Unable to detect site';
        }
    }

    /**
     * Load all user scripts from storage
     * Retrieves scripts via background script and renders matching ones
     */
    async loadScripts() {
        this.sendMessage({ action: 'getScripts' }, (response) => {
            if (response.scripts) {
                this.scripts = response.scripts;
                this.renderScripts();
            }
        });
    }

    /**
     * Render scripts that match the current tab's URL
     * Filters scripts by URL pattern and displays them in the popup
     */
    renderScripts() {
        const container = document.getElementById('scriptsList');

        if (!this.currentTab?.url) {
            container.innerHTML = '<div class="no-scripts">Cannot access current site</div>';
            return;
        }

        const matching = this.getMatchingScripts(this.currentTab.url);

        if (matching.length === 0) {
            container.innerHTML = '<div class="no-scripts">No scripts for this site</div>';
            return;
        }

        container.innerHTML = '';
        matching.forEach(script => {
            container.appendChild(this.createScriptElement(script));
        });
    }

    /**
     * Find scripts that match the current tab's URL
     * Filters all scripts by URL pattern matching
     *
     * @param {string} url - Current tab URL to match against
     * @returns {Array} Array of matching scripts with their patterns
     */
    getMatchingScripts(url) {
        return Object.entries(this.scripts)
            .filter(([pattern]) => this.urlMatchesPattern(url, pattern))
            .map(([pattern, script]) => ({ pattern, ...script }));
    }

    /**
     * Check if URL matches a script's pattern
     * Supports wildcard patterns for flexible domain matching
     *
     * @param {string} url - Current page URL
     * @param {string} pattern - Script URL pattern to match against
     * @returns {boolean} True if URL matches the pattern
     */
    urlMatchesPattern(url, pattern) {
        if (pattern === '*') return true;
        if (pattern.startsWith('*.')) {
            return url.includes(pattern.slice(2));
        }
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\//g, '.*') + '$');
            return regex.test(url);
        }
        return url.includes(pattern);
    }

    /**
     * Create HTML element for a script in the popup
     * Generates interactive script card with toggle, run, and edit buttons
     *
     * @param {Object} script - Script object with pattern, name, description, etc.
     * @returns {HTMLElement} Script element ready for DOM insertion
     */
    createScriptElement(script) {
        const div = document.createElement('div');
        div.className = 'script-item';

        const enabled = script.enabled !== false;

        div.innerHTML = `
            <div class="script-header">
                <div class="script-name">${this.escapeHtml(script.name)}</div>
                <button class="script-toggle ${enabled ? 'enabled' : ''}" data-pattern="${script.pattern}" 
                    title="${enabled ? 'Click to disable' : 'Click to enable'}"></button>
            </div>
            <div class="script-desc">${this.escapeHtml(script.description || 'No description')}</div>
            <div class="script-actions">
                <button class="btn-primary run-btn" data-pattern="${script.pattern}">▶ Run Now</button>
                <button class="btn-secondary edit-btn" data-pattern="${script.pattern}">Edit</button>
            </div>
        `;

        div.querySelector('.script-toggle').addEventListener('click', () => {
            this.toggleScript(script.pattern, !enabled);
        });

        div.querySelector('.run-btn').addEventListener('click', () => {
            this.runScript(script.pattern, script.code);
        });

        div.querySelector('.edit-btn').addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') + '?edit=' + encodeURIComponent(script.pattern) });
        });

        return div;
    }

    /**
     * Toggle script enabled/disabled state
     * Updates script status in storage and refreshes display
     *
     * @param {string} pattern - Script URL pattern
     * @param {boolean} enabled - New enabled state
     */
    toggleScript(pattern, enabled) {
        this.sendMessage(
            { action: 'toggleScript', scriptId: pattern, enabled },
            () => this.loadScripts()
        );
    }

    /**
     * Execute script immediately on current tab
     * Sends script code to background script for execution
     *
     * @param {string} pattern - Script URL pattern
     * @param {string} code - JavaScript code to execute
     */
    runScript(pattern, code) {
        if (!this.currentTab) return;

        this.sendMessage(
            {
                action: 'executeScript',
                tabId: this.currentTab.id,
                code: code,
                scriptId: pattern
            },
            (response) => {
                if (response.error) {
                    console.error('Execution failed:', response.error);
                    alert('Script execution failed: ' + response.error);
                } else {
                    console.log('Script executed successfully');
                }
            }
        );
    }

    /**
     * Set up click handlers for popup buttons
     * Handles navigation to script management page
     */
    setupEventListeners() {
        document.getElementById('manageScripts').addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        });
    }

    /**
     * Set up automatic refresh when scripts are modified
     * Listens for storage changes to update popup in real-time
     */
    setupRefresh() {
        chrome.storage.local.onChanged.addListener(() => {
            this.loadScripts();
        });
    }

    /**
     * Send message to background script
     * Wrapper for chrome.runtime.sendMessage with error handling
     *
     * @param {Object} message - Message object to send
     * @param {Function} callback - Callback function for response
     */
    sendMessage(message, callback) {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Message error:', chrome.runtime.lastError);
            }
            callback(response || {});
        });
    }

    /**
     * Escape HTML characters to prevent XSS
     * Safely renders user-provided content in HTML
     *
     * @param {string} text - Text to escape
     * @returns {string} HTML-safe text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const popupManager = new PopupManager();
