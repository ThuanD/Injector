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
                    settings: { autoRun: true, debugMode: false }
                });
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
     * Creates a blob URL to inject script as an external file
     *
     * @param {number} tabId - Target tab ID
     * @param {string} code - JavaScript code to execute
     * @param {string} scriptId - Script identifier for logging
     * @param {Function} sendResponse - Function to send execution result
     */
    async executeScriptInTab(tabId, code, scriptId, sendResponse) {
        try {
            const blob = new Blob([code], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);

            await chrome.scripting.executeScript({
                target: { tabId },
                files: [url]
            });

            URL.revokeObjectURL(url);
            this.addLog(`Executed: ${scriptId}`, 'execute', 'success');
            sendResponse({ success: true });
        } catch (error) {
            this.addLog(`Failed: ${scriptId}`, 'execute', 'error');
            sendResponse({ error: error.message });
        }
    }

    /**
     * Execute script in main world context (bypasses CSP)
     * Uses function injection to run code directly in page context
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
                world: 'MAIN',
                func: (scriptCode) => {
                    try {
                        eval(scriptCode);
                    } catch (error) {
                        console.error('Script execution error:', error);
                    }
                },
                args: [code]
            });

            this.addLog(`Executed in MAIN: ${scriptId}`, 'execute', 'success');
            sendResponse({ success: true });
        } catch (error) {
            this.addLog(`Failed in MAIN: ${scriptId}`, 'execute', 'error');
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
}

const backgroundManager = new BackgroundScriptManager();
