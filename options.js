class OptionsManager {
    constructor() {
        this.scripts = {};
        this.filteredScripts = {};
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.loadScripts();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('addScript').addEventListener('click', () => {
            this.showScriptModal();
        });

        document.getElementById('addFromTemplate').addEventListener('click', () => {
            this.showTemplateSelector();
        });

        document.getElementById('searchBox').addEventListener('input', (e) => {
            this.filterScripts(e.target.value);
        });

        document.getElementById('exportScripts').addEventListener('click', () => {
            this.exportScripts();
        });

        document.getElementById('importScripts').addEventListener('click', () => {
            this.importScripts();
        });

        // Check for edit parameter in URL
        const params = new URLSearchParams(window.location.search);
        if (params.has('edit')) {
            setTimeout(() => {
                const pattern = params.get('edit');
                if (this.scripts[pattern]) {
                    this.editScript(pattern);
                }
            }, 500);
        }
    }

    async loadScripts() {
        this.sendMessage({ action: 'getScripts' }, (response) => {
            if (response.scripts) {
                this.scripts = response.scripts;
                this.filteredScripts = { ...this.scripts };
                this.renderScripts();
            }
        });
    }

    filterScripts(query) {
        const search = query.toLowerCase();
        this.filteredScripts = {};

        Object.entries(this.scripts).forEach(([pattern, script]) => {
            const matches =
                pattern.toLowerCase().includes(search) ||
                script.name.toLowerCase().includes(search) ||
                (script.description || '').toLowerCase().includes(search);

            if (matches) {
                this.filteredScripts[pattern] = script;
            }
        });

        this.renderScripts();
    }

    renderScripts() {
        const container = document.getElementById('scriptsList');
        const scripts = Object.entries(this.filteredScripts);

        if (scripts.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1;">
                    <div class="empty-state">
                        <h3>No scripts found</h3>
                        <p style="color: var(--text-light); margin-top: 8px;">
                            ${Object.keys(this.scripts).length === 0 
                                ? 'Create your first script to get started' 
                                : 'Try a different search query'}
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        scripts.forEach(([pattern, script]) => {
            container.appendChild(this.createScriptCard(pattern, script));
        });
    }

    createScriptCard(pattern, script) {
        const div = document.createElement('div');
        div.className = 'script-card';

        const enabled = script.enabled !== false;
        const created = script.createdAt ? new Date(script.createdAt).toLocaleDateString() : 'Unknown';

        div.innerHTML = `
            <div class="script-card-header">
                <div>
                    <div class="script-card-title">${this.escapeHtml(script.name)}</div>
                    <div class="script-card-pattern">Pattern: ${this.escapeHtml(pattern)}</div>
                </div>
                <div style="text-align: right; font-size: 11px; color: var(--text-light);">
                    ${enabled ? '✓ Active' : '✗ Disabled'}
                </div>
            </div>
            <div class="script-card-desc">${this.escapeHtml(script.description || 'No description')}</div>
            <div style="font-size: 12px; color: var(--text-light); margin: 12px 0;">
                Created: ${created}
            </div>
            <div class="script-card-actions">
                <button class="btn btn-primary edit-btn" data-id="${pattern}">✏️ Edit</button>
                <button class="btn btn-secondary view-btn" data-id="${pattern}">👁️ View Code</button>
                <button class="btn btn-danger delete-btn" data-id="${pattern}">🗑️ Delete</button>
            </div>
        `;

        div.querySelector('.edit-btn').addEventListener('click', () => {
            this.editScript(pattern);
        });

        div.querySelector('.view-btn').addEventListener('click', () => {
            this.viewCode(pattern);
        });

        div.querySelector('.delete-btn').addEventListener('click', () => {
            this.deleteScript(pattern);
        });

        return div;
    }

    showTemplateSelector() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const templatesHTML = Object.entries(SCRIPT_TEMPLATES)
            .map(([key, template]) => `
                <div class="template-card" data-template="${key}">
                    <div class="template-card-category">${template.category}</div>
                    <div class="template-card-title">${template.name}</div>
                    <div class="template-card-desc">${template.description}</div>
                </div>
            `).join('');

        modal.innerHTML = `
            <div class="modal" style="max-width: 900px;">
                <h2>📋 Choose a Template</h2>
                <p style="color: var(--text-light); margin-bottom: 20px; font-size: 14px;">
                    Choose a template to get started quickly. You can edit it after selecting.
                </p>
                <div class="templates-grid">
                    ${templatesHTML}
                </div>
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="btn cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add click handlers for template cards
        modal.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const templateKey = card.dataset.template;
                const template = SCRIPT_TEMPLATES[templateKey];
                document.body.removeChild(modal);
                this.showScriptModalWithTemplate(template);
            });
        });

        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showScriptModalWithTemplate(template) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        modal.innerHTML = `
            <div class="modal">
                <h2>➕ Add Script from Template</h2>
                <p style="color: var(--text-light); margin-bottom: 16px; font-size: 13px;">
                    Template: <strong>${template.name}</strong>
                </p>
                
                <div class="form-group">
                    <label>Script Name *</label>
                    <input type="text" id="scriptName" value="${this.escapeHtml(template.name)}" 
                        placeholder="e.g., My Custom Script">
                </div>

                <div class="form-group">
                    <label>URL Pattern *</label>
                    <input type="text" id="urlPattern" value="" 
                        placeholder="e.g., *.example.com or https://example.com/*">
                    <div class="pattern-help">
                        <strong>Pattern examples:</strong><br>
                        • <code>*</code> - Run on all websites<br>
                        • <code>*.example.com</code> - All subdomains of example.com<br>
                        • <code>https://example.com/*</code> - Specific domain<br>
                        • <code>example.com/path/*</code> - Specific path
                    </div>
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <textarea id="scriptDescription" 
                        placeholder="Describe what this script does...">${this.escapeHtml(template.description)}</textarea>
                </div>

                <div class="form-group">
                    <label>JavaScript Code *</label>
                    <textarea id="scriptCode" placeholder="Enter your JavaScript code here..." 
                        required style="min-height: 250px;">${this.escapeHtml(template.code)}</textarea>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary save-btn">Add Script</button>
                    <button class="btn cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.save-btn').addEventListener('click', async () => {
            await this.saveScript();
            document.body.removeChild(modal);
        });

        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        document.getElementById('urlPattern').focus();
    }

    showScriptModal(scriptId = null) {
        this.currentEditId = scriptId;
        const existingScript = scriptId ? this.scripts[scriptId] : null;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        modal.innerHTML = `
            <div class="modal">
                <h2>${scriptId ? '✏️ Edit Script' : '➕ Add New Script'}</h2>
                
                <div class="form-group">
                    <label>Script Name *</label>
                    <input type="text" id="scriptName" value="${this.escapeHtml(existingScript?.name || '')}" 
                        placeholder="e.g., My Custom Script">
                </div>

                <div class="form-group">
                    <label>URL Pattern *</label>
                    <input type="text" id="urlPattern" value="${this.escapeHtml(scriptId || '')}" 
                        placeholder="e.g., *.example.com or https://example.com/*" 
                        ${scriptId ? 'readonly style="background: var(--bg);"' : ''}>
                    <div class="pattern-help">
                        <strong>Pattern examples:</strong><br>
                        • <code>*</code> - Run on all websites<br>
                        • <code>*.example.com</code> - All subdomains of example.com<br>
                        • <code>https://example.com/*</code> - Specific domain<br>
                        • <code>example.com/path/*</code> - Specific path
                    </div>
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <textarea id="scriptDescription" 
                        placeholder="Describe what this script does...">${this.escapeHtml(existingScript?.description || '')}</textarea>
                </div>

                <div class="form-group">
                    <label>JavaScript Code *</label>
                    <textarea id="scriptCode" placeholder="Enter your JavaScript code here..." 
                        required>${this.escapeHtml(existingScript?.code || '')}</textarea>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary save-btn">${scriptId ? 'Update' : 'Add'} Script</button>
                    <button class="btn cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.save-btn').addEventListener('click', async () => {
            await this.saveScript();
            document.body.removeChild(modal);
        });

        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        document.getElementById('scriptName').focus();
    }

    async saveScript() {
        const name = document.getElementById('scriptName').value.trim();
        const pattern = document.getElementById('urlPattern').value.trim();
        const description = document.getElementById('scriptDescription').value.trim();
        const code = document.getElementById('scriptCode').value.trim();

        if (!name || !pattern || !code) {
            alert('❌ Please fill in all required fields marked with *');
            return;
        }

        const scriptData = { name, description, code, pattern };

        this.sendMessage(
            { action: 'saveScript', scriptId: pattern, scriptData },
            (response) => {
                if (response.success) {
                    this.scripts[pattern] = scriptData;
                    this.filteredScripts = { ...this.scripts };
                    this.renderScripts();
                    console.log(`✅ Script saved: ${pattern}`);
                } else {
                    alert('❌ Failed to save script: ' + (response.error || 'Unknown error'));
                }
            }
        );
    }

    editScript(id) {
        this.showScriptModal(id);
    }

    viewCode(id) {
        const script = this.scripts[id];
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        modal.innerHTML = `
            <div class="modal" style="max-width: 700px;">
                <h2>👁️ View Code: ${this.escapeHtml(script.name)}</h2>
                <pre style="background: var(--bg); padding: 16px; border-radius: 6px; 
                    overflow-x: auto; font-size: 13px; line-height: 1.5;"><code>${this.escapeHtml(script.code)}</code></pre>
                <div class="modal-actions">
                    <button class="btn btn-primary close-btn" style="flex: 0.5;">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.close-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    deleteScript(id) {
        if (!confirm(`🗑️ Delete script "${this.scripts[id].name}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        this.sendMessage(
            { action: 'deleteScript', scriptId: id },
            (response) => {
                if (response.success) {
                    delete this.scripts[id];
                    delete this.filteredScripts[id];
                    this.renderScripts();
                    console.log(`✅ Script deleted: ${id}`);
                } else {
                    alert('❌ Failed to delete script: ' + (response.error || 'Unknown error'));
                }
            }
        );
    }

    exportScripts() {
        const data = JSON.stringify(this.scripts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webcustomizer-scripts-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('✅ Scripts exported');
    }

    importScripts() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    const count = Object.keys(imported).length;

                    if (confirm(`Import ${count} script(s)? Existing scripts with same patterns will be overwritten.`)) {
                        this.scripts = { ...this.scripts, ...imported };
                        this.filteredScripts = { ...this.scripts };

                        this.sendMessage(
                            { action: 'saveScript', scriptId: Object.keys(imported)[0], scriptData: Object.values(imported)[0] },
                            () => {
                                this.loadScripts();
                                console.log(`✅ Imported ${count} script(s)`);
                            }
                        );
                    }
                } catch (error) {
                    alert('❌ Invalid JSON file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    sendMessage(message, callback) {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Message error:', chrome.runtime.lastError);
                callback({ error: chrome.runtime.lastError.message });
            } else {
                callback(response || {});
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const optionsManager = new OptionsManager();
