/**
 * BackgroundScriptManager - Main background script for the Web Customizer Chrome extension
 *
 * This class manages:
 * - Chrome extension lifecycle events (install, messages)
 * - User script storage and management
 * - Script execution in different contexts
 * - Settings and logging
 *
 * Acts as the central coordinator between popup, content scripts, and storage.
 */
class BackgroundScriptManager {
    /**
     * Constructor - Initialize the background script manager
     * Sets up logging system and initializes event listeners
     */
    constructor() {
        this.logs = [];
        this.MAX_LOGS = 100;
        this.init();
    }

    /**
     * Initialize event listeners for the extension
     * Sets up listeners for installation and runtime messages
     */
    async init() {
        chrome.runtime.onInstalled.addListener(async (details) => {
            if (details.reason === 'install') {
                await this.initializeStorage();
                console.log('✅ Web Customizer installed');
            }
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }
    /**
     * Initialize default storage structure if not exists
     * Creates empty userScripts object and default settings
     */
    async initializeStorage() {
        try {
            const { userScripts } = await chrome.storage.local.get('userScripts');
            if (!userScripts) {
                await chrome.storage.local.set({
                    userScripts: {},
                    hiddenSettings: {},
                    settings: { autoRun: true, debugMode: false }
                });
            } else {
                // Ensure hiddenSettings exists for legacy updates
                const { hiddenSettings } = await chrome.storage.local.get('hiddenSettings');
                if (!hiddenSettings) {
                    await chrome.storage.local.set({ hiddenSettings: {} });
                }
            }
        } catch (error) {
            console.error('❌ Failed to initialize storage:', error);
        }
    }

    /**
     * Handle incoming messages from content scripts and popup
     * Routes different actions to appropriate handler methods
     *
     * @param {Object} request - Message object with action and data
     * @param {Object} sender - Information about message sender
     * @param {Function} sendResponse - Function to send response back
     */
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getScripts':
                    await this.getScripts(sendResponse);
                    break;
                case 'saveScript':
                    await this.saveScript(request.scriptId, request.scriptData, sendResponse);
                    break;
                case 'deleteScript':
                    await this.deleteScript(request.scriptId, sendResponse);
                    break;
                case 'toggleScript':
                    await this.toggleScript(request.scriptId, request.enabled, sendResponse);
                    break;
                case 'getActiveTab':
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        sendResponse({ tab: tabs[0] || null });
                    });
                    break;
                case 'executeScript':
                    await this.executeScriptInTab(request.tabId, request.code, request.scriptId, sendResponse);
                    break;
                case 'executeScriptInMainWorld':
                    await this.executeScriptInMainWorld(sender.tab.id, request.code, request.scriptId, sendResponse);
                    break;
                case 'getSettings':
                    await this.getSettings(sendResponse);
                    break;
                case 'saveSettings':
                    await this.saveSettings(request.settings, sendResponse);
                    break;
                case 'getLogs':
                    sendResponse({ logs: this.logs });
                    break;
                case 'getHiddenSettings':
                    await this.getHiddenSettings(request.hostname, sendResponse);
                    break;
                case 'saveHiddenSettings':
                    await this.saveHiddenSettings(request.hostname, request.settings, sendResponse);
                    break;
                case 'sendTelegram':
                    await this.sendTelegramMessage(request.botToken, request.chatId, request.message, sendResponse);
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handler error:', error);
            sendResponse({ error: error.message });
        }
    }

    /**
     * Retrieve all user scripts from storage
     * @param {Function} sendResponse - Function to send scripts back to caller
     */
    async getScripts(sendResponse) {
        const { userScripts } = await chrome.storage.local.get('userScripts');
        sendResponse({ scripts: userScripts || {} });
    }

    /**
     * Save or update a user script
     * @param {string} scriptId - Unique identifier for the script
     * @param {Object} scriptData - Script data including name, code, and pattern
     * @param {Function} sendResponse - Function to send success confirmation
     */
    async saveScript(scriptId, scriptData, sendResponse) {
        const { userScripts } = await chrome.storage.local.get('userScripts');
        const scripts = userScripts || {};

        scripts[scriptId] = {
            ...scriptData,
            enabled: true,
            createdAt: scripts[scriptId]?.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        await chrome.storage.local.set({ userScripts: scripts });
        this.addLog(`Script saved: ${scriptData.name}`, 'save');
        sendResponse({ success: true });
    }

    /**
     * Delete a user script from storage
     * @param {string} scriptId - Unique identifier of script to delete
     * @param {Function} sendResponse - Function to send deletion confirmation
     */
    async deleteScript(scriptId, sendResponse) {
        const { userScripts } = await chrome.storage.local.get('userScripts');
        const scripts = userScripts || {};

        if (scripts[scriptId]) {
            delete scripts[scriptId];
            await chrome.storage.local.set({ userScripts: scripts });
            this.addLog(`Script deleted: ${scriptId}`, 'delete');
            sendResponse({ success: true });
        } else {
            sendResponse({ error: 'Script not found' });
        }
    }

    /**
     * Enable or disable a user script
     * @param {string} scriptId - Unique identifier of script to toggle
     * @param {boolean} enabled - New enabled state
     * @param {Function} sendResponse - Function to send confirmation
     */
    async toggleScript(scriptId, enabled, sendResponse) {
        const { userScripts } = await chrome.storage.local.get('userScripts');
        const scripts = userScripts || {};

        if (scripts[scriptId]) {
            scripts[scriptId].enabled = enabled;
            await chrome.storage.local.set({ userScripts: scripts });
            this.addLog(`Script ${enabled ? 'enabled' : 'disabled'}: ${scriptId}`, 'toggle');
            sendResponse({ success: true });
        }
    }

    /**
     * Execute script in isolated world context of a tab
     * Uses chrome.scripting.executeScript with function injection
     *
     * @param {number} tabId - Target tab ID
     * @param {string} code - JavaScript code to execute
     * @param {string} scriptId - Script identifier for logging
     * @param {Function} sendResponse - Function to send execution result
     */
    async executeScriptInTab(tabId, code, scriptId, sendResponse) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: (scriptCode) => {
                    try {
                        // Create a function from the code and execute it
                        const fn = new Function(scriptCode);
                        fn();
                    } catch (error) {
                        console.error('Script execution error:', error);
                        throw error;
                    }
                },
                args: [code]
            });

            this.addLog(`Executed: ${scriptId}`, 'execute', 'success');
            sendResponse({ success: true });
        } catch (error) {
            this.addLog(`Failed: ${scriptId}`, 'execute', 'error');
            sendResponse({ error: error.message });
        }
    }

    /**
     * Execute script in MAIN world context using blob URL technique
     * 
     * This is THE ONLY METHOD that bypasses strict CSP with nonce:
     * - Creates a blob:// URL containing the script
     * - Blob URLs are exempt from CSP script-src restrictions
     * - Works on sites like Binance that use nonce-based CSP
     * 
     * How it works:
     * 1. Create a Blob containing the JavaScript code
     * 2. Create a URL from the Blob (blob://...)
     * 3. Inject <script src="blob://...">
     * 4. Browser loads and executes the blob (CSP doesn't block blob://)
     * 5. Clean up the blob URL after execution
     *
     * @param {number} tabId - Target tab ID
     * @param {string} code - JavaScript code to execute
     * @param {string} scriptId - Script identifier for logging
     * @param {Function} sendResponse - Function to send execution result
     */
    async executeScriptInMainWorld(tabId, code, scriptId, sendResponse) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN', // Execute directly in Main World to access genuine nonces
                func: (scriptCode, scriptName) => {
                    try {
                        // 1. Wrap code for safety
                        const wrappedCode = `
(function() {
    try {
        ${scriptCode}
        console.log('[WebCustomizer] ✅ Script executed: ${scriptName}');
    } catch (error) {
        console.error('[WebCustomizer] Script execution error in "${scriptName}":', error);
    }
})();
                        `;

                        // 2. Create inline script element
                        const script = document.createElement('script');
                        script.textContent = wrappedCode;

                        // 3. AGGRESSIVE Nonce Stealing
                        // In Main World, we have access to the real nonces
                        let nonce = null;
                        
                        // Try standard property first
                        const scriptWithNonce = document.querySelector('script[nonce]');
                        if (scriptWithNonce) {
                            nonce = scriptWithNonce.nonce;
                        }

                        // Fallback: iterate all scripts if querySelector fails/is blocked
                        if (!nonce) {
                            for (const s of document.scripts) {
                                if (s.nonce) {
                                    nonce = s.nonce;
                                    break;
                                }
                            }
                        }

                        // Apply nonce if found
                        if (nonce) {
                            script.setAttribute('nonce', nonce);
                        }

                        // 4. Inject
                        (document.head || document.documentElement).appendChild(script);
                        
                        // 5. Cleanup
                        script.remove();

                    } catch (error) {
                        console.error('[WebCustomizer] Injection error:', error);
                        throw error;
                    }
                },
                args: [code, scriptId]
            });

            this.addLog(`Executed in MAIN: ${scriptId}`, 'execute', 'success');
            sendResponse({ success: true });
        } catch (error) {
            this.addLog(`Failed: ${scriptId}`, 'execute', 'error');
            sendResponse({ error: error.message });
        }
    }


    /**
     * Retrieve extension settings from storage
     * @param {Function} sendResponse - Function to send settings back
     */
    async getSettings(sendResponse) {
        const { settings } = await chrome.storage.local.get('settings');
        sendResponse({ settings: settings || { autoRun: true, debugMode: false } });
    }

    /**
     * Save extension settings to storage
     * @param {Object} settings - Settings object to save
     * @param {Function} sendResponse - Function to send confirmation
     */
    async saveSettings(settings, sendResponse) {
        await chrome.storage.local.set({ settings });
        sendResponse({ success: true });
    }

    /**
     * Add a log entry to the internal log system
     * Maintains a rolling buffer of recent logs
     *
     * @param {string} message - Log message
     * @param {string} type - Log type (info, save, delete, toggle, execute)
     * @param {string} status - Log status (success, error)
     */
    addLog(message, type = 'info', status = 'success') {
        this.logs.unshift({
            message,
            type,
            status,
            timestamp: new Date().toLocaleTimeString()
        });
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }
    }

    /**
     * Retrieve hidden element settings for a hostname
     * @param {string} hostname - Target hostname
     * @param {Function} sendResponse - Function to send settings back
     */
    async getHiddenSettings(hostname, sendResponse) {
        const { hiddenSettings } = await chrome.storage.local.get('hiddenSettings');
        const settings = hiddenSettings || {};
        sendResponse({ settings: settings[hostname] || null });
    }

    /**
     * Save hidden element settings for a hostname
     * @param {string} hostname - Target hostname
     * @param {Object} settings - Settings object { enabled: boolean, selectors: string }
     * @param {Function} sendResponse - Function to send confirmation
     */
    async saveHiddenSettings(hostname, settings, sendResponse) {
        const { hiddenSettings } = await chrome.storage.local.get('hiddenSettings');
        const currentSettings = hiddenSettings || {};

        currentSettings[hostname] = settings;

        await chrome.storage.local.set({ hiddenSettings: currentSettings });
        this.addLog(`Updated hidden elements for ${hostname}`, 'save');
        sendResponse({ success: true });
    }

    /**
 * Send Telegram notification via Bot API
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message to send
 * @param {Function} sendResponse - Response callback
 */
    async sendTelegramMessage(botToken, chatId, message, sendResponse) {
        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.addLog('Telegram notification sent', 'telegram', 'success');
                sendResponse({ success: true, data: result });
            } else {
                this.addLog('Telegram notification failed', 'telegram', 'error');
                sendResponse({ success: false, error: result.description || 'Unknown error' });
            }
        } catch (error) {
            this.addLog('Telegram API error', 'telegram', 'error');
            sendResponse({ success: false, error: error.message });
        }
    }
}

const backgroundManager = new BackgroundScriptManager();
