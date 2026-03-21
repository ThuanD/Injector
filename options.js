class OptionsManager {
  constructor() {
    this.scripts = {};
    this.filtered = {};
    this.currentFilter = 'all';
    this.editId = null;
    this.init();
  }

  async init() {
    this.setupNav();
    this.setupSearch();
    this.setupToolbar();
    this.setupSettings();
    this.setupGuide();
    await this.loadScripts();
    this.renderTemplates();
    this.checkUrlParams();
  }

  /* ── NAVIGATION ── */
  setupNav() {
    document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
      item.addEventListener('click', () => this.goTo(item.dataset.page));
    });
  }

  goTo(page) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  }

  /* ── TOOLBAR / SEARCH ── */
  setupSearch() {
    document.getElementById('searchInput').addEventListener('input', e => {
      this.applyFilter(e.target.value, this.currentFilter);
    });
  }

  setupToolbar() {
    document.getElementById('addScriptBtn').addEventListener('click', () => this.openModal());
    document.getElementById('topAddBtn').addEventListener('click', () => this.openModal());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportScripts());
    document.getElementById('importBtn').addEventListener('click', () => this.importScripts());

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        const q = document.getElementById('searchInput').value;
        this.applyFilter(q, this.currentFilter);
      });
    });
  }

  applyFilter(query, filter) {
    const q = query.toLowerCase();
    this.filtered = {};
    Object.entries(this.scripts).forEach(([id, s]) => {
      const matchSearch = !q ||
        id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q);

      const matchFilter =
        filter === 'all' ||
        (filter === 'active' && s.enabled !== false) ||
        (filter === 'disabled' && s.enabled === false);

      if (matchSearch && matchFilter) this.filtered[id] = s;
    });
    this.renderGrid();
  }

  /* ── LOAD & RENDER ── */
  async loadScripts() {
    return new Promise(resolve => {
      this.send({ action: 'getScripts' }, res => {
        this.scripts = res.scripts || {};
        this.filtered = { ...this.scripts };
        this.renderGrid();
        this.updateStats();
        resolve();
      });
    });
  }

  updateStats() {
    const all    = Object.values(this.scripts);
    const active = all.filter(s => s.enabled !== false).length;
    const domains = new Set(Object.keys(this.scripts).map(p => {
      try { return new URL(p.replace(/\*/g, 'x')).hostname; } catch { return p; }
    })).size;

    document.getElementById('st-total').textContent   = all.length;
    document.getElementById('st-active').textContent  = active;
    document.getElementById('st-domains').textContent = domains;
    document.getElementById('sideCount').textContent  = all.length;
    document.getElementById('statTotal').textContent  = all.length;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statDisabled').textContent = all.length - active;
  }

  renderGrid() {
    const grid   = document.getElementById('scriptsGrid');
    const entries = Object.entries(this.filtered);

    if (entries.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1">
          <div class="empty-state">
            <div class="empty-icon">${Object.keys(this.scripts).length === 0 ? '📭' : '🔍'}</div>
            <div class="empty-title">${Object.keys(this.scripts).length === 0 ? 'No scripts yet' : 'No results'}</div>
            <div class="empty-desc">${Object.keys(this.scripts).length === 0
              ? 'Create your first script or pick a template to get started.'
              : 'Try a different search query or filter.'
            }</div>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = '';
    entries.forEach(([id, script], i) => {
      const card = this.buildCard(id, script, i);
      grid.appendChild(card);
    });
  }

  buildCard(id, script, index) {
    const enabled  = script.enabled !== false;
    const created  = script.createdAt ? new Date(script.createdAt).toLocaleDateString() : '—';
    const updated  = script.updatedAt ? new Date(script.updatedAt).toLocaleDateString() : '—';
    const lines    = (script.code || '').split('\n').length;

    const div = document.createElement('div');
    div.className = `script-card${enabled ? '' : ' disabled-card'}`;
    div.style.animationDelay = `${index * 35}ms`;

    div.innerHTML = `
      <div class="sc-top">
        <div class="sc-dot ${enabled ? '' : 'off'}"></div>
        <div class="sc-name" title="${this.esc(script.name)}">${this.esc(script.name)}</div>
        <input type="checkbox" class="sc-toggle" ${enabled ? 'checked' : ''} title="Toggle">
      </div>
      <div class="sc-pattern" title="${this.esc(id)}">${this.esc(id)}</div>
      <div class="sc-desc">${this.esc(script.description || 'No description')}</div>
      <div class="sc-meta">
        <span class="sc-tag">📅 ${created}</span>
        <span class="sc-tag">📝 ${lines} lines</span>
      </div>
      <div class="sc-actions">
        <button class="sc-btn edit-btn">✏ Edit</button>
        <button class="sc-btn view-btn">👁 View</button>
        <button class="sc-btn dup-btn">⧉ Dup</button>
        <button class="sc-btn del del-btn">🗑</button>
      </div>
    `;

    const toggle = div.querySelector('.sc-toggle');
    toggle.addEventListener('change', () => this.toggleScript(id, toggle.checked, div));

    div.querySelector('.edit-btn').addEventListener('click', () => this.openModal(id));
    div.querySelector('.view-btn').addEventListener('click', () => this.viewCode(id));
    div.querySelector('.dup-btn').addEventListener('click', () => this.duplicateScript(id));
    div.querySelector('.del-btn').addEventListener('click', () => this.deleteScript(id));

    return div;
  }

  /* ── TOGGLE ── */
  toggleScript(id, enabled, cardEl) {
    this.scripts[id].enabled = enabled;
    cardEl.classList.toggle('disabled-card', !enabled);
    cardEl.querySelector('.sc-dot').classList.toggle('off', !enabled);
    this.send({ action: 'toggleScript', scriptId: id, enabled }, () => {
      this.updateStats();
      this.toast(enabled ? `"${this.scripts[id].name}" enabled ✓` : 'Script disabled', enabled ? 'success' : '');
    });
  }

  /* ── DUPLICATE ── */
  duplicateScript(id) {
    const src = this.scripts[id];
    const newId = id + '_copy_' + Date.now();
    const newData = { ...src, name: src.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now() };
    this.send({ action: 'saveScript', scriptId: newId, scriptData: newData }, res => {
      if (res.success) {
        this.scripts[newId] = newData;
        this.filtered[newId] = newData;
        this.renderGrid();
        this.updateStats();
        this.toast('Script duplicated ✓', 'success');
      }
    });
  }

  /* ── VIEW CODE ── */
  viewCode(id) {
    const s = this.scripts[id];
    const overlay = this.makeOverlay();
    overlay.querySelector('.modal').innerHTML = `
      <div class="modal-header">
        <div class="modal-title">👁 ${this.esc(s.name)}</div>
        <button class="modal-close close-btn">✕</button>
      </div>
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px;font-family:'JetBrains Mono',monospace">${this.esc(id)}</div>
      <pre class="code-view">${this.esc(s.code || '')}</pre>
      <div class="modal-actions">
        <button class="modal-btn cancel copy-code-btn">⎘ Copy Code</button>
        <button class="modal-btn save edit-from-view-btn">✏ Edit</button>
      </div>
    `;
    overlay.querySelector('.close-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.copy-code-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(s.code || '').then(() => this.toast('Code copied!', 'success'));
    });
    overlay.querySelector('.edit-from-view-btn').addEventListener('click', () => {
      overlay.remove();
      this.openModal(id);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ── MODAL (Add/Edit) ── */
  openModal(editId = null) {
    this.editId = editId;
    const s = editId ? this.scripts[editId] : null;

    const overlay = this.makeOverlay();
    overlay.querySelector('.modal').innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${editId ? '✏ Edit Script' : '＋ New Script'}</div>
        <button class="modal-close close-btn">✕</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Script Name <span class="req">*</span></label>
          <input type="text" id="f-name" class="form-input" placeholder="My Awesome Script" value="${this.esc(s?.name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">URL Pattern <span class="req">*</span></label>
          <input type="text" id="f-pattern" class="form-input" placeholder="*.example.com" value="${this.esc(editId || '')}">
        </div>
        <div class="form-group full">
          <label class="form-label">Description</label>
          <textarea id="f-desc" class="form-textarea" rows="2" placeholder="What does this script do?">${this.esc(s?.description || '')}</textarea>
        </div>
        <div class="form-group full">
          <div class="pattern-hint">
            <strong style="color:var(--text)">Pattern examples:</strong>
            &nbsp;
            <code>*</code> all sites &nbsp;·&nbsp;
            <code>*.example.com</code> subdomains &nbsp;·&nbsp;
            <code>https://example.com/*</code> path &nbsp;·&nbsp;
            <code>example.com/blog/*</code> sub-path
          </div>
        </div>
        <div class="form-group full">
          <label class="form-label">JavaScript Code <span class="req">*</span></label>
          <div class="code-warning">
            <div class="code-warning-icon">⚠️</div>
            <div class="code-warning-text">
              <strong>Chỉ paste code từ nguồn bạn tin tưởng.</strong>
              Script có thể đọc mọi dữ liệu trên trang — kể cả mật khẩu và cookie.
              Không chắc code làm gì? <a href="#" onclick="document.querySelector('[data-page=\\'guide\\']').click();return false">Đọc hướng dẫn →</a>
            </div>
          </div>
          <textarea id="f-code" class="form-textarea code" placeholder="// Your JavaScript code here…">${this.esc(s?.code || '')}</textarea>
        </div>
        <label class="confirm-row" id="secConfirmRow">
          <input type="checkbox" id="secConfirm">
          <span class="confirm-row-label">Tôi hiểu rằng script này sẽ chạy trên trang web được chỉ định và <strong>tôi tin tưởng code này là an toàn</strong></span>
        </label>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel close-btn">Cancel</button>
        <button class="modal-btn save save-btn">${editId ? '💾 Update' : '＋ Add Script'}</button>
      </div>
    `;

    overlay.querySelectorAll('.close-btn').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.querySelector('.save-btn').addEventListener('click', () => this.saveScript(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#f-name').focus();
  }

  openModalWithTemplate(tpl) {
    this.editId = null;
    const overlay = this.makeOverlay();
    overlay.querySelector('.modal').innerHTML = `
      <div class="modal-header">
        <div class="modal-title">📋 Add from Template</div>
        <button class="modal-close close-btn">✕</button>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:18px;padding:8px 12px;background:rgba(61,214,245,.06);border:1px solid rgba(61,214,245,.15);border-radius:7px">
        Template: <strong style="color:var(--accent)">${this.esc(tpl.name)}</strong>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Script Name <span class="req">*</span></label>
          <input type="text" id="f-name" class="form-input" value="${this.esc(tpl.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">URL Pattern <span class="req">*</span></label>
          <input type="text" id="f-pattern" class="form-input" placeholder="*.example.com">
        </div>
        <div class="form-group full">
          <label class="form-label">Description</label>
          <textarea id="f-desc" class="form-textarea" rows="2">${this.esc(tpl.description)}</textarea>
        </div>
        <div class="form-group full">
          <label class="form-label">JavaScript Code <span class="req">*</span></label>
          <div class="code-warning">
            <div class="code-warning-icon">⚠️</div>
            <div class="code-warning-text">
              <strong>Chỉ paste code từ nguồn bạn tin tưởng.</strong>
              Script có thể đọc mọi dữ liệu trên trang — kể cả mật khẩu và cookie.
              Không chắc code làm gì? <a href="#" onclick="document.querySelector('[data-page=\\'guide\\']').click();return false">Đọc hướng dẫn →</a>
            </div>
          </div>
          <textarea id="f-code" class="form-textarea code">${this.esc(tpl.code)}</textarea>
        </div>
        <label class="confirm-row" id="secConfirmRow">
          <input type="checkbox" id="secConfirm" checked>
          <span class="confirm-row-label">Tôi hiểu rằng script này sẽ chạy trên trang web được chỉ định và <strong>tôi tin tưởng code này là an toàn</strong> <span style="color:var(--success);font-size:11px">(template đã được kiểm duyệt ✓)</span></span>
        </label>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel close-btn">Cancel</button>
        <button class="modal-btn save save-btn">＋ Add Script</button>
      </div>
    `;
    overlay.querySelectorAll('.close-btn').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.querySelector('.save-btn').addEventListener('click', () => this.saveScript(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#f-pattern').focus();
  }

  async saveScript(overlay) {
    const name    = overlay.querySelector('#f-name').value.trim();
    const pattern = overlay.querySelector('#f-pattern').value.trim();
    const desc    = overlay.querySelector('#f-desc').value.trim();
    const code    = overlay.querySelector('#f-code').value.trim();

    if (!name || !pattern || !code) {
      this.toast('Please fill in Name, Pattern and Code', 'error');
      return;
    }

    const confirmEl = overlay.querySelector('#secConfirm');
    if (confirmEl && !confirmEl.checked) {
      // Shake the confirm row to draw attention
      const row = overlay.querySelector('#secConfirmRow');
      if (row) {
        row.style.transition = 'transform .1s';
        [0,1,2,3].reduce((p, i) => p.then(() => new Promise(r => {
          setTimeout(() => { row.style.transform = i % 2 === 0 ? 'translateX(6px)' : 'translateX(-6px)'; r(); }, i * 80);
        })), Promise.resolve()).then(() => { row.style.transform = ''; });
        row.style.borderColor = 'rgba(255,90,113,.5)';
        setTimeout(() => { row.style.borderColor = ''; }, 1500);
      }
      this.toast('⚠️ Hãy xác nhận bạn tin tưởng code này trước khi lưu', 'error');
      return;
    }

    const scriptData = { name, description: desc, code, pattern };
    const oldId = this.editId;

    this.send({ action: 'saveScript', scriptId: pattern, scriptData }, async res => {
      if (!res.success) { this.toast('Save failed: ' + (res.error || '?'), 'error'); return; }

      this.scripts[pattern] = { ...scriptData, enabled: this.scripts[pattern]?.enabled ?? true };

      // Handle rename: delete old key
      if (oldId && oldId !== pattern) {
        await new Promise(resolve => {
          this.send({ action: 'deleteScript', scriptId: oldId }, () => {
            delete this.scripts[oldId];
            resolve();
          });
        });
      }

      this.filtered = { ...this.scripts };
      this.renderGrid();
      this.updateStats();
      overlay.remove();
      this.toast(`"${name}" saved ✓`, 'success');
    });
  }

  deleteScript(id) {
    const name = this.scripts[id]?.name || id;
    if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;
    this.send({ action: 'deleteScript', scriptId: id }, res => {
      if (res.success) {
        delete this.scripts[id];
        delete this.filtered[id];
        this.renderGrid();
        this.updateStats();
        this.toast(`"${name}" deleted`, 'warn');
      }
    });
  }

  /* ── TEMPLATES ── */
  renderTemplates() {
    const grid = document.getElementById('templatesGrid');
    grid.innerHTML = '';
    Object.entries(SCRIPT_TEMPLATES).forEach(([key, tpl], i) => {
      const card = document.createElement('div');
      card.className = 'script-card';
      card.style.animationDelay = `${i * 30}ms`;
      card.innerHTML = `
        <div class="sc-top" style="margin-bottom:8px">
          <span class="tpl-cat">${this.esc(tpl.category)}</span>
        </div>
        <div class="sc-name" style="margin-bottom:6px;font-size:14px">${this.esc(tpl.name)}</div>
        <div class="sc-desc" style="margin-bottom:12px;-webkit-line-clamp:3">${this.esc(tpl.description)}</div>
        <div class="sc-actions">
          <button class="sc-btn use-tpl" style="flex:2">＋ Use Template</button>
          <button class="sc-btn preview-tpl">👁</button>
        </div>
      `;
      card.querySelector('.use-tpl').addEventListener('click', () => {
        this.goTo('scripts');
        this.openModalWithTemplate(tpl);
      });
      card.querySelector('.preview-tpl').addEventListener('click', () => {
        const ov = this.makeOverlay();
        ov.querySelector('.modal').innerHTML = `
          <div class="modal-header">
            <div class="modal-title">👁 ${this.esc(tpl.name)}</div>
            <button class="modal-close close-btn">✕</button>
          </div>
          <pre class="code-view">${this.esc(tpl.code)}</pre>
          <div class="modal-actions">
            <button class="modal-btn cancel close-btn">Close</button>
            <button class="modal-btn save use-btn">＋ Use This Template</button>
          </div>
        `;
        ov.querySelectorAll('.close-btn').forEach(b => b.addEventListener('click', () => ov.remove()));
        ov.querySelector('.use-btn').addEventListener('click', () => {
          ov.remove();
          this.goTo('scripts');
          this.openModalWithTemplate(tpl);
        });
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
      });
      grid.appendChild(card);
    });
  }

  /* ── SETTINGS ── */
  setupSettings() {
    // Load settings
    this.send({ action: 'getSettings' }, res => {
      const s = res.settings || {};
      document.getElementById('set-autorun').checked = s.autoRun !== false;
      document.getElementById('set-debug').checked   = !!s.debugMode;
    });

    ['set-autorun','set-debug'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        const s = {
          autoRun:   document.getElementById('set-autorun').checked,
          debugMode: document.getElementById('set-debug').checked
        };
        this.send({ action: 'saveSettings', settings: s }, () => this.toast('Settings saved ✓', 'success'));
      });
    });

    document.getElementById('set-export').addEventListener('click', () => this.exportScripts());
    document.getElementById('set-import').addEventListener('click', () => this.importScripts());
    document.getElementById('set-deleteAll').addEventListener('click', () => {
      if (!confirm('Delete ALL scripts? This cannot be undone!')) return;
      const ids = Object.keys(this.scripts);
      Promise.all(ids.map(id => new Promise(r => this.send({ action: 'deleteScript', scriptId: id }, r))))
        .then(() => {
          this.scripts = {}; this.filtered = {};
          this.renderGrid(); this.updateStats();
          this.toast('All scripts deleted', 'warn');
        });
    });
  }

  /* ── EXPORT / IMPORT ── */
  exportScripts() {
    const data = JSON.stringify(this.scripts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `webcustom-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    this.toast('Scripts exported ↓', 'success');
  }

  importScripts() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        const entries  = Object.entries(imported);
        if (!entries.length) { this.toast('No scripts found in file', 'error'); return; }
        if (!confirm(`Import ${entries.length} script(s)? Existing matches will be overwritten.`)) return;

        let ok = 0, fail = 0;
        for (const [id, data] of entries) {
          await new Promise(r => this.send({ action: 'saveScript', scriptId: id, scriptData: data },
            res => { res.success ? ok++ : fail++; r(); }));
        }
        await this.loadScripts();
        this.toast(`Imported ${ok} script(s)${fail ? `, ${fail} failed` : ''} ✓`, fail ? 'warn' : 'success');
      } catch (err) {
        this.toast('Invalid JSON: ' + err.message, 'error');
      }
    };
    input.click();
  }

  /* ── GUIDE ── */
  setupGuide() {
    const PROMPTS = [
      {
        label: 'Ẩn phần tử',
        title: 'Ẩn quảng cáo / phần tử không cần',
        preview: 'Write a JS script to hide [mô tả phần tử] on [tên trang]...',
        prompt: `Write a JavaScript script to automatically hide [MÔ TẢ PHẦN TỬ - ví dụ: the floating chat button, the sidebar ads, the cookie banner] on [TÊN TRANG WEB].

Requirements:
- Wrapped in an IIFE: (function() { ... })();
- Vanilla JS only, no external libraries
- Use MutationObserver to also hide elements that load dynamically
- Add console.log('[WebCustom] Done') at the end
- Put configurable selectors as constants at the top with comments`,
      },
      {
        label: 'Tự động hóa',
        title: 'Tự động click / điền form',
        preview: 'Write a JS script to automatically [click/fill] on [trang]...',
        prompt: `Write a JavaScript script to automatically [MÔ TẢ HÀNH ĐỘNG - ví dụ: click the "Accept cookies" button, fill in the login form with my credentials, skip the intro animation] on [TÊN TRANG WEB].

Requirements:
- Wrapped in an IIFE: (function() { ... })();
- Vanilla JS only, no external libraries
- Handle the case where the element might not exist yet (use setTimeout or MutationObserver)
- Add console.log('[WebCustom] Done') at the end
- Put any configurable values (selectors, credentials, timing) as constants at the top`,
      },
      {
        label: 'Theo dõi / Alert',
        title: 'Thông báo khi có thay đổi',
        preview: 'Write a JS script to monitor [nội dung] and alert when changed...',
        prompt: `Write a JavaScript script to monitor [MÔ TẢ NỘI DUNG CẦN THEO DÕI - ví dụ: the price of the product, the stock status, a specific text element] on [TÊN TRANG WEB] and show a browser notification or console alert when it changes.

Requirements:
- Wrapped in an IIFE: (function() { ... })();
- Vanilla JS only, no external libraries
- Check every [30] seconds using setInterval
- Store the previous value in localStorage to persist across page reloads
- Show an alert or console.log when change is detected
- Put config variables (selector, interval, storage key) at the top as constants`,
      },
      {
        label: 'Giao diện',
        title: 'Thay đổi giao diện trang',
        preview: 'Write a JS script to change the styling/layout of [trang]...',
        prompt: `Write a JavaScript script to [MÔ TẢ THAY ĐỔI GIAO DIỆN - ví dụ: make the font larger and more readable, change the background to dark mode, hide the left sidebar and make the content area wider, increase line spacing] on [TÊN TRANG WEB].

Requirements:
- Wrapped in an IIFE: (function() { ... })();
- Vanilla JS only — inject a <style> tag with CSS, do not use external stylesheets
- Use !important on CSS rules to override site styles
- The script should be toggleable: running it again should undo the changes
- Add console.log('[WebCustom] Style applied/removed') at the end`,
      },
      {
        label: 'Thu thập dữ liệu',
        title: 'Lấy / copy dữ liệu từ trang',
        preview: 'Write a JS script to collect [dữ liệu] from [trang] and copy...',
        prompt: `Write a JavaScript script to collect [MÔ TẢ DỮ LIỆU - ví dụ: all product names and prices, all article titles and links, all table data] from [TÊN TRANG WEB] and copy them to the clipboard as plain text (one item per line) or as CSV.

Requirements:
- Wrapped in an IIFE: (function() { ... })();
- Vanilla JS only, no external libraries
- Use navigator.clipboard.writeText() to copy to clipboard
- Show a toast notification (a small div temporarily injected into the page) when done, displaying how many items were collected
- Put configurable selectors as constants at the top`,
      },
      {
        label: 'Tổng quát',
        title: 'Mô tả tự do bằng tiếng Việt',
        preview: 'Dùng khi bạn chỉ biết mình muốn gì, không biết dùng prompt nào...',
        prompt: `Tôi muốn tạo một script JavaScript chạy tự động trên trang [TÊN TRANG WEB].

Mục tiêu: [MÔ TẢ ĐIỀU BẠN MUỐN SCRIPT LÀM - càng chi tiết càng tốt, viết tiếng Việt cũng được]

Yêu cầu kỹ thuật (bắt buộc để script hoạt động với extension của tôi):
- Bọc trong IIFE: (function() { ... })();
- Chỉ dùng vanilla JavaScript, không dùng thư viện ngoài
- Thêm console.log('[WebCustom] Done') ở cuối
- Các giá trị có thể cấu hình (CSS selector, thời gian, text...) đặt thành hằng số ở đầu file kèm comment giải thích
- Nếu cần xử lý element load động, dùng MutationObserver hoặc setTimeout

Trả về cho tôi đoạn code hoàn chỉnh, không cần giải thích dài dòng.`,
      },
    ];

    const grid = document.getElementById('promptCards');
    if (!grid) return;

    grid.innerHTML = PROMPTS.map((p, i) => `
      <div class="prompt-card">
        <div class="prompt-card-label">${this.esc(p.label)}</div>
        <div class="prompt-card-title">${this.esc(p.title)}</div>
        <div class="prompt-card-preview">${this.esc(p.preview)}</div>
        <div class="prompt-card-footer">
          <button class="copy-prompt-btn" data-idx="${i}">⎘ Copy Prompt</button>
          <a class="open-ai-btn" href="https://chatgpt.com" target="_blank">↗ Mở ChatGPT</a>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.copy-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        navigator.clipboard.writeText(PROMPTS[idx].prompt).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ Đã copy!';
          btn.style.background = 'rgba(45,212,160,.15)';
          btn.style.borderColor = 'rgba(45,212,160,.3)';
          btn.style.color = 'var(--success)';
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
          }, 2000);
          this.toast('Prompt copied! Paste vào ChatGPT ✓', 'success');
        });
      });
    });
  }

  /* ── URL PARAMS ── */
  checkUrlParams() {
    const p = new URLSearchParams(location.search);
    if (p.has('edit')) {
      const id = p.get('edit');
      setTimeout(() => { if (this.scripts[id]) this.openModal(id); }, 300);
    }
    if (p.has('action') && p.get('action') === 'add') {
      setTimeout(() => this.openModal(), 200);
    }
  }

  /* ── HELPERS ── */
  makeOverlay() {
    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.innerHTML = '<div class="modal"></div>';
    return div;
  }

  send(msg, cb) {
    chrome.runtime.sendMessage(msg, res => {
      if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
      cb(res || {});
    });
  }

  esc(t) {
    const d = document.createElement('div');
    d.textContent = String(t ?? '');
    return d.innerHTML;
  }

  toast(msg, type = '', dur = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show${type ? ' ' + type : ''}`;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.remove('show'), dur);
  }
}

const optionsManager = new OptionsManager();
window._om = optionsManager;
